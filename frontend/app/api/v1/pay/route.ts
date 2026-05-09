/**
 * POST /api/v1/pay — Canonical Payment Entry Point
 *
 * This is the single server-side endpoint that handles the full
 * settlement pipeline with a persistent ledger.
 *
 * Pipeline:
 *   1. Validate request body
 *   2. Idempotency check (return existing record if already processed)
 *   3. Create / update transaction in ledger (initiated → verified)
 *   4. Verify Solana USDC transfer on-chain
 *   5. Create settlement record (pending)
 *   6. Execute settlement via Razorpay (synchronous attempt)
 *   7. Update ledger with result (completed / failed)
 *   8. Return structured response
 *
 * On synchronous failure: settlement record stays in DB so the
 * background worker (/api/workers/settlement) can retry automatically.
 *
 * GET /api/v1/payment/:id — poll for async status updates
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyUsdcTransfer }         from "@/lib/verify-tx";
import { initiateRazorpayPayout }     from "@/lib/razorpay";
import {
  createTransaction,
  transitionTransaction,
  createSettlement,
  updateSettlement,
  getTransactionByIdempotencyKey,
} from "@/lib/db/ledger";

export const runtime = "nodejs";
export const maxDuration = 30;          // Vercel function timeout (seconds)

// ── Config ────────────────────────────────────────────────────────────────────

const MAX_INR_PER_TX  = 200_000;        // ₹2 lakh per transaction
const MAX_USDC_PER_TX = 2_500;

const TREASURY_ADDRESS =
  process.env.NEXT_PUBLIC_FEE_WALLET ??
  "G2FAbFQPFa5qKXCetoFZQEvF9TdM4yE6UwqroeN9BCWQ";

// ── Request schema ────────────────────────────────────────────────────────────

interface PayRequest {
  paymentId:        string;
  idempotencyKey:   string;
  merchantUpiId:    string;
  merchantName:     string;
  inrAmount:        number;
  usdcAmount:       number;
  txSignature:      string;
  userId:           string;           // Solana wallet pubkey
  provider?:        string;
  fallbackProvider?: string;
  quoteFxRate?:     number;
  riskScore?:       number;
  riskFlags?:       string[];
}

// ── Validation ────────────────────────────────────────────────────────────────

function validate(
  body: unknown
): { ok: true; data: PayRequest } | { ok: false; error: string; status: number } {
  if (!body || typeof body !== "object")
    return { ok: false, error: "Body must be a JSON object", status: 400 };

  const b = body as Record<string, unknown>;

  if (typeof b.paymentId      !== "string" || !b.paymentId)
    return { ok: false, error: "paymentId is required",       status: 400 };
  if (typeof b.idempotencyKey !== "string" || !b.idempotencyKey)
    return { ok: false, error: "idempotencyKey is required",  status: 400 };
  if (typeof b.merchantUpiId  !== "string" || !b.merchantUpiId.includes("@"))
    return { ok: false, error: "merchantUpiId must be a valid UPI ID (contains @)", status: 400 };
  if (typeof b.merchantName   !== "string" || !b.merchantName.trim())
    return { ok: false, error: "merchantName is required",    status: 400 };
  if (typeof b.inrAmount      !== "number" || b.inrAmount  <= 0)
    return { ok: false, error: "inrAmount must be positive",  status: 400 };
  if (typeof b.usdcAmount     !== "number" || b.usdcAmount <= 0)
    return { ok: false, error: "usdcAmount must be positive", status: 400 };
  if (typeof b.userId         !== "string" || !b.userId.trim())
    return { ok: false, error: "userId is required",          status: 400 };
  if (typeof b.txSignature    !== "string" || !b.txSignature.trim())
    return { ok: false, error: "txSignature is required",     status: 400 };

  if (b.inrAmount  > MAX_INR_PER_TX)
    return { ok: false, error: `₹${(b.inrAmount as number).toLocaleString("en-IN")} exceeds per-tx limit of ₹${MAX_INR_PER_TX.toLocaleString("en-IN")}`, status: 422 };
  if (b.usdcAmount > MAX_USDC_PER_TX)
    return { ok: false, error: `${b.usdcAmount} USDC exceeds per-tx limit of ${MAX_USDC_PER_TX} USDC`, status: 422 };

  return {
    ok: true,
    data: {
      paymentId:       b.paymentId      as string,
      idempotencyKey:  b.idempotencyKey as string,
      merchantUpiId:   (b.merchantUpiId as string).trim(),
      merchantName:    (b.merchantName  as string).trim(),
      inrAmount:       b.inrAmount      as number,
      usdcAmount:      b.usdcAmount     as number,
      txSignature:     (b.txSignature   as string).trim(),
      userId:          (b.userId        as string).trim(),
      provider:        typeof b.provider        === "string" ? b.provider        : "razorpay",
      fallbackProvider: typeof b.fallbackProvider === "string" ? b.fallbackProvider : undefined,
      quoteFxRate:     typeof b.quoteFxRate === "number"   ? b.quoteFxRate     : undefined,
      riskScore:       typeof b.riskScore  === "number"    ? b.riskScore       : undefined,
      riskFlags:       Array.isArray(b.riskFlags)          ? b.riskFlags as string[] : undefined,
    },
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const start = Date.now();

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const validation = validate(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }
  const d = validation.data;

  console.log(
    `[v1/pay] START paymentId=${d.paymentId} merchant=${d.merchantUpiId} ` +
    `inr=₹${d.inrAmount} usdc=${d.usdcAmount} provider=${d.provider}`
  );

  // ── 1. Idempotency check ─────────────────────────────────────────────────────
  const existingResult = await getTransactionByIdempotencyKey(d.idempotencyKey);
  if (existingResult.ok) {
    const existing = existingResult.data;
    if (existing.status === "completed") {
      console.log(`[v1/pay] IDEMPOTENT HIT (completed) paymentId=${d.paymentId}`);
      return NextResponse.json({
        success:        true,
        paymentId:      existing.payment_id,
        status:         existing.status,
        fromCache:      true,
        durationMs:     Date.now() - start,
      });
    }
    // For non-completed states, continue processing below
    console.log(`[v1/pay] Existing record found, status=${existing.status} — continuing`);
  }

  // ── 2. Create / ensure transaction record ─────────────────────────────────
  const demoMode = process.env.DEMO_SETTLEMENT === "true";

  const txnResult = await createTransaction({
    payment_id:       d.paymentId,
    idempotency_key:  d.idempotencyKey,
    user_id:          d.userId,
    merchant_upi_id:  d.merchantUpiId,
    merchant_name:    d.merchantName,
    inr_amount:       d.inrAmount,
    usdc_amount:      d.usdcAmount,
    quote_fx_rate:    d.quoteFxRate,
    tx_signature:     d.txSignature,
    status:           "signed",
    risk_score:       d.riskScore,
    risk_flags:       d.riskFlags,
    provider:         d.provider,
    fallback_provider: d.fallbackProvider,
  });

  if (!txnResult.ok) {
    console.error("[v1/pay] Failed to create ledger record:", txnResult.error);
    // Non-fatal: continue even if DB write fails (degrade gracefully)
  }

  const txnId = txnResult.ok ? txnResult.data.id : null;

  // ── 3. Verify Solana TX ───────────────────────────────────────────────────
  let verifiedTx = false;

  if (!demoMode) {
    console.log(`[v1/pay] Verifying tx: ${d.txSignature.slice(0, 12)}…`);
    const verification = await verifyUsdcTransfer({
      signature:           d.txSignature,
      expectedFromAddress: d.userId,
      expectedToAddress:   TREASURY_ADDRESS,
      expectedUsdcAmount:  d.usdcAmount,
    });

    verifiedTx = verification.verified;

    if (!verification.verified) {
      // Hard block — do not settle
      if (txnId) {
        await transitionTransaction(txnId, "failed", {
          reason:          "Solana TX verification failed",
          errorMessage:    verification.failureReason,
          failureCategory: "tx_simulation_failed",
        });
      }

      console.error(`[v1/pay] TX VERIFICATION FAILED reason="${verification.failureReason}"`);
      return NextResponse.json(
        {
          success:         false,
          paymentId:       d.paymentId,
          error:           verification.failureReason ?? "Transaction verification failed",
          failureCategory: "tx_simulation_failed",
          retryable:       false,
          verifiedTx:      false,
          demoMode:        false,
          durationMs:      Date.now() - start,
        },
        { status: 422 }
      );
    }

    console.log(`[v1/pay] TX verified OK`);
  } else {
    verifiedTx = true;  // demo mode: skip verification
    console.log(`[v1/pay] DEMO mode — skipping TX verification`);
  }

  // Transition to verified
  if (txnId) {
    await transitionTransaction(txnId, "verified", { reason: "Solana USDC transfer confirmed" });
  }

  // ── 4. Create settlement record ───────────────────────────────────────────
  let settlementId: string | null = null;

  if (txnId) {
    const stlResult = await createSettlement({
      transaction_id: txnId,
      provider:       d.provider ?? "razorpay",
      status:         "pending",
    });
    settlementId = stlResult.ok ? stlResult.data.id : null;

    if (txnId) {
      await transitionTransaction(txnId, "settling", { reason: `Settlement queued via ${d.provider}` });
    }
  }

  // ── 5. Execute settlement ─────────────────────────────────────────────────
  if (demoMode) {
    // Simulate settlement
    await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
    const utr = `DEMO_UTR${Date.now()}`;
    const payoutId = `demo_payout_${d.paymentId}`;

    if (txnId)       await transitionTransaction(txnId, "completed", { reason: "Demo settlement completed" });
    if (settlementId) await updateSettlement(settlementId, { status: "completed", utr, provider_payout_id: payoutId, raw_response: { demo: true } });

    console.log(`[v1/pay] DEMO SUCCESS paymentId=${d.paymentId} utr=${utr}`);
    return NextResponse.json({
      success:    true,
      paymentId:  d.paymentId,
      payoutId,
      utrNumber:  utr,
      status:     "completed",
      verifiedTx,
      demoMode:   true,
      provider:   "demo",
      durationMs: Date.now() - start,
    });
  }

  // Real settlement via Razorpay
  const razorpayResult = await initiateRazorpayPayout({
    amount:        d.inrAmount,
    upiId:         d.merchantUpiId,
    recipientName: d.merchantName,
    referenceId:   d.idempotencyKey,
    description:   `Auron ${d.paymentId.slice(0, 8)}`,
  });

  const durationMs = Date.now() - start;

  if (razorpayResult.success) {
    // Update ledger to completed
    if (txnId) {
      await transitionTransaction(txnId, "completed", {
        reason: `Razorpay payout succeeded payoutId=${razorpayResult.payoutId}`,
      });
    }
    if (settlementId) {
      await updateSettlement(settlementId, {
        status:             "completed",
        provider_payout_id: razorpayResult.payoutId,
        utr:                razorpayResult.utr,
        last_checked_at:    new Date(),
        raw_response:       razorpayResult as unknown as Record<string, unknown>,
      });
    }

    console.log(
      `[v1/pay] SUCCESS paymentId=${d.paymentId} ` +
      `payoutId=${razorpayResult.payoutId} utr=${razorpayResult.utr ?? "pending"} ` +
      `durationMs=${durationMs}`
    );

    return NextResponse.json({
      success:    true,
      paymentId:  d.paymentId,
      payoutId:   razorpayResult.payoutId,
      utrNumber:  razorpayResult.utr,
      status:     razorpayResult.status ?? "processed",
      verifiedTx,
      demoMode:   false,
      provider:   "razorpay",
      durationMs,
    });
  }

  // Settlement failed — update ledger but leave settlement as 'pending' for worker retry
  const httpStatus = razorpayResult.retryable ? 502 : 422;

  if (txnId && !razorpayResult.retryable) {
    // Non-retryable: mark failed immediately
    await transitionTransaction(txnId, "failed", {
      reason:          `Razorpay payout non-retryable error: ${razorpayResult.error}`,
      errorMessage:    razorpayResult.error,
      failureCategory: razorpayResult.errorCode ?? "offramp_rejected",
    });
    if (settlementId) {
      await updateSettlement(settlementId, {
        status:      "failed",
        retry_count: 3,   // Max out retries so worker skips it
        raw_response: razorpayResult as unknown as Record<string, unknown>,
      });
    }
  } else if (settlementId) {
    // Retryable: reset to pending so worker picks it up
    await updateSettlement(settlementId, {
      status:      "pending",
      raw_response: razorpayResult as unknown as Record<string, unknown>,
    });
  }

  console.error(
    `[v1/pay] FAILED paymentId=${d.paymentId} ` +
    `error="${razorpayResult.error}" retryable=${razorpayResult.retryable} ` +
    `durationMs=${durationMs}`
  );

  return NextResponse.json(
    {
      success:         false,
      paymentId:       d.paymentId,
      error:           razorpayResult.error,
      errorCode:       razorpayResult.errorCode,
      failureCategory: razorpayResult.errorCode ?? "offramp_rejected",
      retryable:       razorpayResult.retryable,
      verifiedTx,
      demoMode:        false,
      durationMs,
    },
    { status: httpStatus }
  );
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed — use POST" }, { status: 405 });
}
