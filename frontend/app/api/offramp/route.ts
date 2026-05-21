/**
 * /api/offramp — Settlement execution endpoint
 *
 * Pipeline (in order):
 *   1. Validate request body
 *   2. Idempotency check via ledger DB (replace duplicate requests)
 *   3. Create ledger record (status: initiated)
 *   4. Verify Solana transaction on-chain
 *   5. Transition ledger → verified
 *   6. Create settlement record + transition → settling
 *   7. Execute payout via provider (OnMeta / demo)
 *   8. Transition ledger → completed | failed
 *   9. Return result
 *
 * Environment flags:
 *   DEMO_SETTLEMENT=true   — skip real payout, return simulated result
 *                            TX verification still runs if a signature is present
 *   ONMETA_API_KEY         — production OnMeta key; missing = demo mode
 */

import { NextRequest, NextResponse } from "next/server";
import { withRetry, isNonRetryableOfframpError } from "@/lib/retry";
import { verifyUsdcTransfer } from "@/lib/verify-tx";
import {
  createTransaction,
  transitionTransaction,
  createSettlement,
  updateSettlement,
  getTransactionByIdempotencyKey,
} from "@/lib/db/ledger";
import type { OnMetaPayoutRequest, OnMetaPayoutResult } from "@/lib/onmeta";

export const runtime = "nodejs";

// ── Config ────────────────────────────────────────────────────────────────────

const MAX_INR_PER_TX  = 200_000;   // ₹2 lakh per transaction
const MAX_USDC_PER_TX = 2_500;

const TREASURY_ADDRESS =
  process.env.NEXT_PUBLIC_FEE_WALLET ??
  "G2FAbFQPFa5qKXCetoFZQEvF9TdM4yE6UwqroeN9BCWQ";

// ── Request type ──────────────────────────────────────────────────────────────

interface ValidatedRequest extends OnMetaPayoutRequest {
  paymentId:      string;
  idempotencyKey: string;
}

// ── Validation ────────────────────────────────────────────────────────────────

function validate(body: unknown): { ok: true; data: ValidatedRequest } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Body must be a JSON object" };
  const b = body as Record<string, unknown>;

  if (typeof b.paymentId      !== "string" || !b.paymentId)      return { ok: false, error: "paymentId is required" };
  if (typeof b.idempotencyKey !== "string" || !b.idempotencyKey) return { ok: false, error: "idempotencyKey is required" };
  if (typeof b.merchantUpiId  !== "string" || !b.merchantUpiId.includes("@"))
    return { ok: false, error: "merchantUpiId must be a valid UPI ID" };
  if (typeof b.merchantName   !== "string" || !b.merchantName.trim()) return { ok: false, error: "merchantName is required" };
  if (typeof b.inrAmount      !== "number" || b.inrAmount  <= 0)  return { ok: false, error: "inrAmount must be a positive number" };
  if (typeof b.usdcAmount     !== "number" || b.usdcAmount <= 0)  return { ok: false, error: "usdcAmount must be a positive number" };
  if (typeof b.userId         !== "string" || !b.userId.trim())   return { ok: false, error: "userId is required" };

  if (b.inrAmount  > MAX_INR_PER_TX)  return { ok: false, error: `₹${(b.inrAmount as number).toLocaleString("en-IN")} exceeds per-tx limit of ₹${MAX_INR_PER_TX.toLocaleString("en-IN")}` };
  if (b.usdcAmount > MAX_USDC_PER_TX) return { ok: false, error: `${b.usdcAmount} USDC exceeds per-tx limit of ${MAX_USDC_PER_TX} USDC` };

  return {
    ok: true,
    data: {
      paymentId:      b.paymentId as string,
      idempotencyKey: b.idempotencyKey as string,
      merchantUpiId:  (b.merchantUpiId as string).trim(),
      merchantName:   (b.merchantName  as string).trim(),
      inrAmount:      b.inrAmount  as number,
      usdcAmount:     b.usdcAmount as number,
      txSignature:    typeof b.txSignature === "string" ? b.txSignature : "",
      userId:         (b.userId as string).trim(),
    },
  };
}

// ── Provider: OnMeta ──────────────────────────────────────────────────────────

async function callOnMeta(req: ValidatedRequest, attempt: number, demoMode: boolean): Promise<OnMetaPayoutResult> {
  if (demoMode) {
    console.log(`[OnMeta DEMO] attempt=${attempt} paymentId=${req.paymentId}`);
    await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
    return {
      success:           true,
      payoutId:          `demo_payout_${req.paymentId}`,
      status:            "completed",
      utrNumber:         `DEMO_UTR${Date.now()}`,
      estimatedDelivery: "Simulated — DEMO_SETTLEMENT=true",
    };
  }

  const onmetaKey = process.env.ONMETA_API_KEY!;
  const res = await fetch("https://api.onmeta.in/v1/offramp/initiate", {
    method:  "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         onmetaKey,
      "x-idempotency-key": req.idempotencyKey,
    },
    body: JSON.stringify({
      amount_usdc:      req.usdcAmount,
      upi_id:           req.merchantUpiId,
      beneficiary_name: req.merchantName,
      reference_id:     req.txSignature || req.paymentId,
      fiat_amount:      req.inrAmount,
      currency:         "INR",
      internal_id:      req.paymentId,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(`OnMeta ${res.status}: ${err.message ?? res.statusText}`);
  }

  const data = await res.json() as Record<string, unknown>;
  return {
    success:           true,
    payoutId:          String(data.payout_id ?? data.id ?? req.paymentId),
    status:            (data.status as OnMetaPayoutResult["status"]) ?? "processing",
    utrNumber:         data.utr ? String(data.utr) : undefined,
    estimatedDelivery: String(data.estimated_delivery ?? "10–30 seconds"),
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const start = Date.now();

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const validation = validate(body);
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });

  const data     = validation.data;
  const apiKey   = process.env.ONMETA_API_KEY;
  const demoMode = process.env.DEMO_SETTLEMENT === "true" || !apiKey || apiKey === "demo";

  console.log(`[offramp] START paymentId=${data.paymentId} merchant=${data.merchantUpiId} inr=₹${data.inrAmount} usdc=${data.usdcAmount} demo=${demoMode}`);

  // ── 1. Idempotency check via ledger ─────────────────────────────────────────
  const existing = await getTransactionByIdempotencyKey(data.idempotencyKey);
  if (existing.ok) {
    const txn = existing.data;
    console.log(`[offramp] IDEMPOTENT HIT paymentId=${data.paymentId} existingStatus=${txn.status}`);
    return NextResponse.json({
      fromCache:    true,
      paymentId:    txn.payment_id,
      status:       txn.status,
      provider:     txn.provider ?? "onmeta",
      demoMode,
      verifiedTx:   txn.status !== "initiated" && txn.status !== "failed",
    });
  }

  // ── 2. Create ledger record (initiated) ─────────────────────────────────────
  const createResult = await createTransaction({
    payment_id:      data.paymentId,
    idempotency_key: data.idempotencyKey,
    user_id:         data.userId,
    merchant_upi_id: data.merchantUpiId,
    merchant_name:   data.merchantName,
    inr_amount:      data.inrAmount,
    usdc_amount:     data.usdcAmount,
    status:          "initiated",
    provider:        demoMode ? "demo" : "onmeta",
  });

  if (!createResult.ok) {
    // Another request created it concurrently — treat as idempotent
    console.warn(`[offramp] createTransaction failed (likely race): ${createResult.error}`);
  }

  const transactionId = createResult.ok ? createResult.data.id : null;

  // ── 3. Verify Solana transaction ─────────────────────────────────────────────
  let verifiedTx = false;
  let verifyReason: string | undefined;
  let blockTime: number | undefined;

  if (data.txSignature) {
    const verification = await verifyUsdcTransfer({
      signature:           data.txSignature,
      expectedFromAddress: data.userId,
      expectedToAddress:   TREASURY_ADDRESS,
      expectedUsdcAmount:  data.usdcAmount,
    });

    verifiedTx   = verification.verified;
    verifyReason = verification.failureReason;
    blockTime    = verification.blockTime;

    if (!verification.verified && !verification.demoMode) {
      // Hard block — record failure in ledger and return
      if (transactionId) {
        await transitionTransaction(transactionId, "failed", {
          reason:          "tx_verification_failed",
          errorMessage:    verifyReason,
          failureCategory: "tx_simulation_failed",
          txSignature:     data.txSignature,
        });
      }
      console.error(`[offramp] TX VERIFICATION FAILED paymentId=${data.paymentId} reason="${verifyReason}"`);
      return NextResponse.json(
        {
          error:           verifyReason ?? "Transaction verification failed",
          failureCategory: "tx_simulation_failed",
          paymentId:       data.paymentId,
          verifiedTx:      false,
          demoMode:        false,
          retryable:       false,
        },
        { status: 422 }
      );
    }

    // Transition to verified
    if (transactionId && verification.verified) {
      await transitionTransaction(transactionId, "verified", {
        reason:      "on_chain_transfer_confirmed",
        txSignature: data.txSignature,
        txBlockTime: blockTime ? new Date(blockTime) : undefined,
      });
    }

    if (!verification.verified && verification.demoMode) {
      console.log(`[offramp] TX not verified but DEMO_SETTLEMENT=true — proceeding with simulated payout`);
    }
  }

  // ── 4. Transition to settling + create settlement record ─────────────────────
  if (transactionId) {
    await transitionTransaction(transactionId, "settling", {
      reason: "initiating_offramp_payout",
    });
  }

  const settlementResult = transactionId
    ? await createSettlement({
        transaction_id: transactionId,
        provider:       demoMode ? "demo" : "onmeta",
        status:         "pending",
      })
    : null;

  const settlementId = settlementResult?.ok ? settlementResult.data.id : null;

  // ── 5. Execute settlement ────────────────────────────────────────────────────
  let result: OnMetaPayoutResult;
  let retryCount = 0;

  try {
    result = await withRetry(
      (attempt) => {
        retryCount = attempt - 1;
        return callOnMeta(data, attempt, demoMode);
      },
      {
        maxAttempts:    3,
        initialDelayMs: 1_500,
        maxDelayMs:     15_000,
        backoffFactor:  2,
        shouldRetry:    (err) => !isNonRetryableOfframpError(err),
        onRetry: (err, attempt, delayMs) => {
          console.warn(`[offramp] RETRY attempt=${attempt} paymentId=${data.paymentId} err="${err.message}" delay=${delayMs}ms`);
        },
      }
    );
  } catch (err: unknown) {
    const message    = err instanceof Error ? err.message : "Payout failed";
    const durationMs = Date.now() - start;
    const category   = classifyFailure(message);

    // Mark ledger as failed
    if (transactionId) {
      await transitionTransaction(transactionId, "failed", {
        reason:          "offramp_payout_failed",
        errorMessage:    message,
        failureCategory: category,
      });
    }
    if (settlementId) {
      await updateSettlement(settlementId, {
        status:       "failed",
        raw_response: { error: message, retryCount },
      });
    }

    console.error(`[offramp] FAILED paymentId=${data.paymentId} retries=${retryCount} err="${message}"`);

    return NextResponse.json(
      {
        error:           message,
        failureCategory: category,
        paymentId:       data.paymentId,
        retryCount,
        durationMs,
        verifiedTx,
        demoMode,
        retryable: !isNonRetryableOfframpError(err instanceof Error ? err : new Error(message)),
      },
      { status: 502 }
    );
  }

  // ── 6. Mark completed in ledger ──────────────────────────────────────────────
  if (transactionId) {
    await transitionTransaction(transactionId, "completed", {
      reason: `payout_${result.status ?? "completed"}`,
    });
  }
  if (settlementId) {
    await updateSettlement(settlementId, {
      status:             result.status === "completed" ? "completed" : "processing",
      provider_payout_id: result.payoutId,
      utr:                result.utrNumber,
      raw_response:       result as unknown as Record<string, unknown>,
    });
  }

  const durationMs = Date.now() - start;

  console.log(
    `[offramp] SUCCESS paymentId=${data.paymentId} payoutId=${result.payoutId} ` +
    `utr=${result.utrNumber ?? "pending"} verified=${verifiedTx} demo=${demoMode} ` +
    `retries=${retryCount} durationMs=${durationMs}`
  );

  return NextResponse.json({
    ...result,
    verifiedTx,
    demoMode,
    provider:   demoMode ? "demo" : "onmeta",
    paymentId:  data.paymentId,
    retryCount,
    durationMs,
    blockTime,
  });
}

// ── Failure classifier ────────────────────────────────────────────────────────

function classifyFailure(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("timeout") || m.includes("abort")) return "offramp_timeout";
  if (m.includes("invalid upi") || m.includes("upi id")) return "offramp_rejected";
  if (m.includes("network") || m.includes("fetch")) return "network_error";
  if (m.includes("400") || m.includes("422")) return "offramp_rejected";
  return "unknown";
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
