/**
 * POST /api/v1/pay — Canonical Payment Entry Point
 *
 * Pipeline:
 *   1. Validate request body
 *   2. Idempotency + replay-protection checks
 *   3. Create ledger record (initiated → quoted → signed)
 *   4. Verify Solana USDC transfer on-chain (hard gate)
 *   5. Transition ledger → verified → settling
 *   6. Create settlement record (pending)
 *   7. Dispatch to correct provider based on routing engine selection
 *   8. Update ledger with result (completed / failed)
 *
 * On synchronous failure: settlement stays pending for worker retry.
 * GET /api/v1/payment/:id — poll for async status updates
 */

import { NextRequest, NextResponse }  from "next/server";
import { verifyUsdcTransfer }          from "@/lib/verify-tx";
import { initiateRazorpayPayout }      from "@/lib/razorpay";
import { initiateOnMetaPayout }        from "@/lib/onmeta";
import {
  createTransaction,
  transitionTransaction,
  createSettlement,
  updateSettlement,
  getTransactionByIdempotencyKey,
  isSignatureAlreadySettled,
} from "@/lib/db/ledger";

export const runtime = "nodejs";
export const maxDuration = 30;

// ── Normalized settlement result ──────────────────────────────────────────────

interface DispatchResult {
  success:    boolean;
  payoutId?:  string;
  utr?:       string;
  status?:    string;
  error?:     string;
  errorCode?: string;
  retryable?: boolean;
  provider:   string;
}

async function dispatchSettlement(
  provider: string,
  params: {
    inrAmount:     number;
    merchantUpiId: string;
    merchantName:  string;
    usdcAmount:    number;
    idempotencyKey: string;
    paymentId:     string;
    txSignature:   string;
    userId:        string;
  }
): Promise<DispatchResult> {
  if (provider === "onmeta") {
    try {
      const r = await initiateOnMetaPayout({
        usdcAmount:    params.usdcAmount,
        merchantUpiId: params.merchantUpiId,
        merchantName:  params.merchantName,
        inrAmount:     params.inrAmount,
        txSignature:   params.txSignature,
        userId:        params.userId,
      });
      return {
        success:   r.success,
        payoutId:  r.payoutId,
        utr:       r.utrNumber,
        status:    r.status,
        provider:  "onmeta",
        retryable: true,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "OnMeta error";
      return { success: false, error: msg, retryable: true, provider: "onmeta" };
    }
  }

  // Default: razorpay
  const r = await initiateRazorpayPayout({
    amount:        params.inrAmount,
    upiId:         params.merchantUpiId,
    recipientName: params.merchantName,
    referenceId:   params.idempotencyKey,
    description:   `Auron ${params.paymentId.slice(0, 8)}`,
  });
  return { ...r, provider: "razorpay" };
}

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
        success: true, paymentId: existing.payment_id,
        status: existing.status, fromCache: true, durationMs: Date.now() - start,
      });
    }
    console.log(`[v1/pay] Existing record status=${existing.status} — continuing`);
  }

  // ── 2. Replay protection ──────────────────────────────────────────────────
  const isStub = d.txSignature.startsWith("demo_") || d.txSignature.startsWith("test_");
  const skipVerification = process.env.DEMO_SETTLEMENT === "true" && isStub;

  if (!skipVerification) {
    const alreadySettled = await isSignatureAlreadySettled(d.txSignature);
    if (alreadySettled) {
      console.warn(`[v1/pay] REPLAY ATTEMPT sig=${d.txSignature.slice(0, 12)}…`);
      return NextResponse.json(
        { success: false, paymentId: d.paymentId, error: "This transaction has already been settled", failureCategory: "duplicate_signature", retryable: false },
        { status: 409 }
      );
    }
  }

  // ── 3. Create ledger record (initiated → quoted → signed) ─────────────────
  const txnResult = await createTransaction({
    payment_id:        d.paymentId,
    idempotency_key:   d.idempotencyKey,
    user_id:           d.userId,
    merchant_upi_id:   d.merchantUpiId,
    merchant_name:     d.merchantName,
    inr_amount:        d.inrAmount,
    usdc_amount:       d.usdcAmount,
    quote_fx_rate:     d.quoteFxRate,
    tx_signature:      d.txSignature,
    status:            "initiated",
    risk_score:        d.riskScore,
    risk_flags:        d.riskFlags,
    provider:          d.provider,
    fallback_provider: d.fallbackProvider,
  });

  if (!txnResult.ok) {
    console.error("[v1/pay] Failed to create ledger record:", txnResult.error);
  }

  const txnId = txnResult.ok ? txnResult.data.id : null;

  // Walk the state machine forward: initiated → quoted → signed
  if (txnId) {
    if (d.quoteFxRate) {
      await transitionTransaction(txnId, "quoted", {
        reason: `FX rate locked at ₹${d.quoteFxRate}/USDC`,
      });
    }
    await transitionTransaction(txnId, "signed", {
      reason:      "User signed on-chain USDC transfer",
      txSignature: d.txSignature,
    });
  }

  // ── 4. Verify Solana TX ───────────────────────────────────────────────────
  let verifiedTx = false;

  if (skipVerification) {
    verifiedTx = true;
    console.log(`[v1/pay] Test stub signature — skipping on-chain verification`);
  } else {
    console.log(`[v1/pay] Verifying tx: ${d.txSignature.slice(0, 12)}…`);
    const verification = await verifyUsdcTransfer({
      signature:           d.txSignature,
      expectedFromAddress: d.userId,
      expectedToAddress:   TREASURY_ADDRESS,
      expectedUsdcAmount:  d.usdcAmount,
    });

    verifiedTx = verification.verified;

    if (!verification.verified) {
      if (txnId) {
        await transitionTransaction(txnId, "failed", {
          reason: "Solana TX verification failed", errorMessage: verification.failureReason, failureCategory: "tx_simulation_failed",
        });
      }
      console.error(`[v1/pay] TX VERIFICATION FAILED reason="${verification.failureReason}"`);
      return NextResponse.json(
        { success: false, paymentId: d.paymentId, error: verification.failureReason ?? "Transaction verification failed", failureCategory: "tx_simulation_failed", retryable: false, verifiedTx: false, durationMs: Date.now() - start },
        { status: 422 }
      );
    }
    console.log(`[v1/pay] TX verified ✓`);
  }

  if (txnId) {
    await transitionTransaction(txnId, "verified", { reason: "On-chain USDC transfer confirmed" });
  }

  // ── 5. Create settlement record + transition to settling ──────────────────
  let settlementId: string | null = null;
  const provider = d.provider ?? "razorpay";

  if (txnId) {
    const stlResult = await createSettlement({ transaction_id: txnId, provider, status: "pending" });
    settlementId = stlResult.ok ? stlResult.data.id : null;
    await transitionTransaction(txnId, "settling", { reason: `Settlement dispatched via ${provider}` });
  }

  // ── 6. Dispatch to provider selected by routing engine ────────────────────
  const result = await dispatchSettlement(provider, {
    inrAmount:      d.inrAmount,
    merchantUpiId:  d.merchantUpiId,
    merchantName:   d.merchantName,
    usdcAmount:     d.usdcAmount,
    idempotencyKey: d.idempotencyKey,
    paymentId:      d.paymentId,
    txSignature:    d.txSignature,
    userId:         d.userId,
  });

  const durationMs = Date.now() - start;

  if (result.success) {
    if (txnId) {
      await transitionTransaction(txnId, "completed", {
        reason: `${provider} payout succeeded payoutId=${result.payoutId}`,
      });
    }
    if (settlementId) {
      await updateSettlement(settlementId, {
        status: "completed", provider_payout_id: result.payoutId,
        utr: result.utr, last_checked_at: new Date(),
        raw_response: result as unknown as Record<string, unknown>,
      });
    }

    console.log(`[v1/pay] SUCCESS paymentId=${d.paymentId} provider=${provider} payoutId=${result.payoutId} utr=${result.utr ?? "pending"} durationMs=${durationMs}`);

    return NextResponse.json({
      success: true, paymentId: d.paymentId,
      payoutId: result.payoutId, utrNumber: result.utr,
      status: result.status ?? "processed",
      verifiedTx, provider, durationMs,
    });
  }

  // ── 7. Settlement failed ──────────────────────────────────────────────────
  const httpStatus = result.retryable ? 502 : 422;

  if (txnId && !result.retryable) {
    await transitionTransaction(txnId, "failed", {
      reason: `${provider} payout non-retryable: ${result.error}`,
      errorMessage: result.error, failureCategory: result.errorCode ?? "offramp_rejected",
    });
    if (settlementId) {
      await updateSettlement(settlementId, { status: "failed", retry_count: 3, raw_response: result as unknown as Record<string, unknown> });
    }
  } else if (settlementId) {
    await updateSettlement(settlementId, { status: "pending", raw_response: result as unknown as Record<string, unknown> });
  }

  console.error(`[v1/pay] FAILED paymentId=${d.paymentId} provider=${provider} error="${result.error}" retryable=${result.retryable} durationMs=${durationMs}`);

  return NextResponse.json(
    { success: false, paymentId: d.paymentId, error: result.error, errorCode: result.errorCode, failureCategory: result.errorCode ?? "offramp_rejected", retryable: result.retryable, verifiedTx, durationMs },
    { status: httpStatus }
  );
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed — use POST" }, { status: 405 });
}
