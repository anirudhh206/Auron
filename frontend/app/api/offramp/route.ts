
import { NextRequest, NextResponse } from "next/server";
import { withRetry, isNonRetryableOfframpError } from "@/lib/retry";
import type { OnMetaPayoutRequest, OnMetaPayoutResult } from "@/lib/onmeta";

export const runtime = "nodejs";

const idempotencyCache = new Map<string, { result: OnMetaPayoutResult; cachedAt: number }>();
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_INR_PER_TX = 200_000;   // ₹2L per transaction
const MAX_USDC_PER_TX = 2_500;    // ~$2,500 per transaction

interface ValidatedRequest extends OnMetaPayoutRequest {
  paymentId: string;
  idempotencyKey: string;
}

function validate(body: unknown): { ok: true; data: ValidatedRequest } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Body must be a JSON object" };
  const b = body as Record<string, unknown>;

  if (typeof b.paymentId !== "string" || !b.paymentId)
    return { ok: false, error: "paymentId is required" };
  if (typeof b.idempotencyKey !== "string" || !b.idempotencyKey)
    return { ok: false, error: "idempotencyKey is required" };
  if (typeof b.merchantUpiId !== "string" || !b.merchantUpiId.trim())
    return { ok: false, error: "merchantUpiId is required" };
  if (typeof b.merchantName !== "string" || !b.merchantName.trim())
    return { ok: false, error: "merchantName is required" };
  if (typeof b.inrAmount !== "number" || b.inrAmount <= 0)
    return { ok: false, error: "inrAmount must be a positive number" };
  if (typeof b.usdcAmount !== "number" || b.usdcAmount <= 0)
    return { ok: false, error: "usdcAmount must be a positive number" };
  if (typeof b.userId !== "string" || !b.userId.trim())
    return { ok: false, error: "userId is required" };

  // Hard limits
  if (b.inrAmount > MAX_INR_PER_TX)
    return { ok: false, error: `Amount ₹${b.inrAmount.toLocaleString("en-IN")} exceeds per-transaction limit of ₹${MAX_INR_PER_TX.toLocaleString("en-IN")}` };
  if (b.usdcAmount > MAX_USDC_PER_TX)
    return { ok: false, error: `USDC amount ${b.usdcAmount} exceeds per-transaction limit of ${MAX_USDC_PER_TX} USDC` };

  // Basic UPI ID format check: must contain @
  const upiId = (b.merchantUpiId as string).trim();
  if (!upiId.includes("@"))
    return { ok: false, error: `Invalid UPI ID format: "${upiId}". Must contain @.` };

  return {
    ok: true,
    data: {
      paymentId: b.paymentId as string,
      idempotencyKey: b.idempotencyKey as string,
      merchantUpiId: upiId,
      merchantName: (b.merchantName as string).trim(),
      inrAmount: b.inrAmount as number,
      usdcAmount: b.usdcAmount as number,
      txSignature: (b.txSignature as string | undefined) ?? "",
      userId: (b.userId as string).trim(),
    },
  };
}

// ─── OnMeta API call (wrapped in retry) ──────────────────────────────────────
async function callOnMeta(req: ValidatedRequest, attempt: number): Promise<OnMetaPayoutResult> {
  const apiKey = process.env.ONMETA_API_KEY;

  // Demo / sandbox mode — no real API key
  if (!apiKey || apiKey === "demo") {
    console.log(`[OnMeta DEMO] Attempt ${attempt} — paymentId=${req.paymentId}`);
    await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));

    return {
      success: true,
      payoutId: `demo_${req.paymentId}`,
      status: "completed",
      utrNumber: `UTR${Date.now()}`,
      estimatedDelivery: "Completed (demo)",
    };
  }

  // Production OnMeta call
  const res = await fetch("https://api.onmeta.in/v1/offramp/initiate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "x-idempotency-key": req.idempotencyKey,  // OnMeta idempotency header
    },
    body: JSON.stringify({
      amount_usdc: req.usdcAmount,
      upi_id: req.merchantUpiId,
      beneficiary_name: req.merchantName,
      reference_id: req.txSignature || req.paymentId,
      fiat_amount: req.inrAmount,
      currency: "INR",
      internal_id: req.paymentId,
    }),
    signal: AbortSignal.timeout(15_000), // 15s per attempt
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({})) as { message?: string };
    const msg = errBody.message ?? res.statusText;
    throw new Error(`OnMeta ${res.status}: ${msg}`);
  }

  const data = await res.json() as Record<string, unknown>;
  return {
    success: true,
    payoutId: String(data.payout_id ?? data.id ?? req.paymentId),
    status: (data.status as OnMetaPayoutResult["status"]) ?? "processing",
    utrNumber: data.utr ? String(data.utr) : undefined,
    estimatedDelivery: String(data.estimated_delivery ?? "10–30 seconds"),
  };
}

// ─── Route handler ────────────────────────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestStart = Date.now();

  // Parse body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate
  const validation = validate(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }
  const data = validation.data;

  console.log(`[offramp] START paymentId=${data.paymentId} upi=${data.merchantUpiId} inr=₹${data.inrAmount} usdc=${data.usdcAmount}`);

  // ── Idempotency check ──────────────────────────────────────────────────────
  const cached = idempotencyCache.get(data.idempotencyKey);
  if (cached && Date.now() - cached.cachedAt < IDEMPOTENCY_TTL_MS) {
    console.log(`[offramp] CACHE HIT paymentId=${data.paymentId} — returning cached result`);
    return NextResponse.json({
      ...cached.result,
      fromCache: true,
    });
  }

  // ── Retry-wrapped OnMeta call ──────────────────────────────────────────────
  let result: OnMetaPayoutResult;
  let retryCount = 0;

  try {
    result = await withRetry(
      (attempt) => {
        retryCount = attempt - 1;
        return callOnMeta(data, attempt);
      },
      {
        maxAttempts: 3,
        initialDelayMs: 1_500,
        maxDelayMs: 15_000,
        backoffFactor: 2,
        shouldRetry: (err) => !isNonRetryableOfframpError(err),
        onRetry: (err, attempt, delayMs) => {
          console.warn(
            `[offramp] RETRY attempt=${attempt} paymentId=${data.paymentId} ` +
            `err="${err.message}" delayMs=${delayMs}`
          );
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Payout failed";
    const durationMs = Date.now() - requestStart;

    console.error(
      `[offramp] FAILED paymentId=${data.paymentId} retries=${retryCount} ` +
      `durationMs=${durationMs} err="${message}"`
    );

    // Classify failure for the client
    const category = classifyFailure(message);

    return NextResponse.json(
      {
        error: message,
        failureCategory: category,
        paymentId: data.paymentId,
        retryCount,
        durationMs,
        // Tell client whether this is retryable
        retryable: !isNonRetryableOfframpError(err instanceof Error ? err : new Error(message)),
      },
      { status: 502 }
    );
  }

  const durationMs = Date.now() - requestStart;

  // ── Cache successful result ────────────────────────────────────────────────
  idempotencyCache.set(data.idempotencyKey, { result, cachedAt: Date.now() });

  console.log(
    `[offramp] SUCCESS paymentId=${data.paymentId} payoutId=${result.payoutId} ` +
    `utr=${result.utrNumber ?? "pending"} retries=${retryCount} durationMs=${durationMs}`
  );

  return NextResponse.json({
    ...result,
    paymentId: data.paymentId,
    retryCount,
    durationMs,
  });
}

// ─── Failure classifier ───────────────────────────────────────────────────────
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
