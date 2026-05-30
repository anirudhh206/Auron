
import { NextRequest, NextResponse } from "next/server";
import { verifyUsdcTransfer } from "@/lib/verify-tx";
import {
  createTransaction,
  transitionTransaction,
  createSettlement,
  getTransactionByIdempotencyKey,
  isSignatureAlreadySettled,
} from "@/lib/db/ledger";

export const runtime = "nodejs";

const MAX_INR_PER_TX  = 200_000;
const MAX_USDC_PER_TX = 2_500;

const TREASURY_ADDRESS = process.env.NEXT_PUBLIC_FEE_WALLET;
if (!TREASURY_ADDRESS) {
  throw new Error("NEXT_PUBLIC_FEE_WALLET is not set. Treasury address is required.");
}

// ── Validation ────────────────────────────────────────────────────────────────

interface ValidatedRequest {
  paymentId:      string;
  idempotencyKey: string;
  merchantUpiId:  string;
  merchantName:   string;
  inrAmount:      number;
  usdcAmount:     number;
  txSignature:    string;
  userId:         string;
}

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

  if (b.inrAmount  > MAX_INR_PER_TX)  return { ok: false, error: `₹${Number(b.inrAmount).toLocaleString("en-IN")} exceeds per-tx limit` };
  if (b.usdcAmount > MAX_USDC_PER_TX) return { ok: false, error: `${b.usdcAmount} USDC exceeds per-tx limit` };

  const data: ValidatedRequest = {
    paymentId:      String(b.paymentId),
    idempotencyKey: String(b.idempotencyKey),
    merchantUpiId:  String(b.merchantUpiId).trim(),
    merchantName:   String(b.merchantName).trim(),
    inrAmount:      Number(b.inrAmount),
    usdcAmount:     Number(b.usdcAmount),
    txSignature:    typeof b.txSignature === "string" ? b.txSignature : "",
    userId:         String(b.userId).trim(),
  };
  return { ok: true, data };
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }

  const validation = validate(body);
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 });

  const data     = validation.data;
  const apiKey   = process.env.ONMETA_API_KEY;
  const demoMode = process.env.DEMO_SETTLEMENT === "true" || !apiKey || apiKey === "demo";

  console.log(`[offramp] START paymentId=${data.paymentId} inr=₹${data.inrAmount} usdc=${data.usdcAmount} demo=${demoMode}`);

  // ── 1. Idempotency check ────────────────────────────────────────────────────
  const existing = await getTransactionByIdempotencyKey(data.idempotencyKey);
  if (existing.ok) {
    const txn = existing.data;
    console.log(`[offramp] IDEMPOTENT HIT paymentId=${data.paymentId} status=${txn.status}`);
    return NextResponse.json({
      queued:    false,
      fromCache: true,
      paymentId: txn.payment_id,
      status:    txn.status,
      message:   "Duplicate request — existing payment returned",
    });
  }

  // ── 2. Replay protection ─────────────────────────────────────────────────────
  const isStub = data.txSignature.startsWith("demo_") || data.txSignature.startsWith("test_");
  const skipVerification = demoMode && isStub;

  if (!skipVerification && data.txSignature) {
    const alreadySettled = await isSignatureAlreadySettled(data.txSignature);
    if (alreadySettled) {
      console.warn(`[offramp] REPLAY ATTEMPT sig=${data.txSignature.slice(0, 12)}…`);
      return NextResponse.json(
        { error: "This transaction has already been settled", failureCategory: "duplicate_signature", paymentId: data.paymentId, retryable: false },
        { status: 409 }
      );
    }
  }

  // ── 3. Create ledger record (initiated → quoted → signed) ───────────────────
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
    tx_signature:    data.txSignature || undefined,
  });

  const transactionId = createResult.ok ? createResult.data.id : null;

  if (transactionId) {
    const computedRate = data.usdcAmount > 0 ? data.inrAmount / data.usdcAmount : undefined;
    if (computedRate) {
      await transitionTransaction(transactionId, "quoted", {
        reason: `FX rate locked at ₹${computedRate.toFixed(2)}/USDC`,
      });
    }
    if (data.txSignature) {
      await transitionTransaction(transactionId, "signed", {
        reason:      "User signed on-chain USDC transfer",
        txSignature: data.txSignature,
      });
    }
  }

  // ── 4. Verify Solana transaction ────────────────────────────────────────────
  let verifiedTx = false;
  let blockTime: number | undefined;

  if (data.txSignature) {
    const verification = await verifyUsdcTransfer({
      signature:           data.txSignature,
      expectedFromAddress: data.userId,
      expectedToAddress:   TREASURY_ADDRESS,
      expectedUsdcAmount:  data.usdcAmount,
    });

    verifiedTx = verification.verified;
    blockTime  = verification.blockTime;

    if (!verification.verified && !verification.demoMode) {
      if (transactionId) {
        await transitionTransaction(transactionId, "failed", {
          reason:          "tx_verification_failed",
          errorMessage:    verification.failureReason,
          failureCategory: "tx_simulation_failed",
          txSignature:     data.txSignature,
        });
      }
      console.error(`[offramp] TX VERIFICATION FAILED paymentId=${data.paymentId} reason="${verification.failureReason}"`);
      return NextResponse.json(
        { error: verification.failureReason ?? "Transaction verification failed", failureCategory: "tx_simulation_failed", paymentId: data.paymentId, retryable: false },
        { status: 422 }
      );
    }

    if (transactionId && verification.verified) {
      await transitionTransaction(transactionId, "verified", {
        reason:      "on_chain_transfer_confirmed",
        txSignature: data.txSignature,
        txBlockTime: blockTime ? new Date(blockTime) : undefined,
      });
    }
  }

  // ── 5. Transition to settling + queue settlement record ─────────────────────
  if (transactionId) {
    await transitionTransaction(transactionId, "settling", {
      reason: "queued_for_async_settlement",
    });
  }

  if (transactionId) {
    await createSettlement({
      transaction_id: transactionId,
      provider:       demoMode ? "demo" : "onmeta",
      status:         "pending",
    });
  }

  console.log(`[offramp] QUEUED paymentId=${data.paymentId} verifiedTx=${verifiedTx}`);

  // ── 6. Return immediately — worker handles the rest ─────────────────────────
  return NextResponse.json({
    queued:     true,
    paymentId:  data.paymentId,
    status:     "settling",
    verifiedTx,
    demoMode,
    blockTime,
    message:    "Payment queued for settlement. Poll /api/v1/payment/:paymentId for status.",
  });
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
