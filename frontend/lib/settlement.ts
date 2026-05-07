/**
 * Auron Settlement Abstraction Layer
 *
 * Unified interface for paying any recipient via any payment rail.
 * The caller never needs to know which provider is being used.
 *
 * Usage:
 *   const result = await settlePayment({
 *     paymentId, idempotencyKey,
 *     recipientId: "merchant@paytm",
 *     recipientName: "Sharma Kirana",
 *     amount: 1000, currency: "INR",
 *     sourceAmountUSDC: 12.05,
 *     txSignature: "...",
 *     userId: "...",
 *     provider: "onmeta",
 *   });
 *
 * Provider adapters live here — add Transak / Stripe / PIX below.
 * The routing engine (lib/routing.ts) decides which adapter to call.
 */

import type { SettlementProvider } from "@/lib/routing";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SettlementCurrency = "INR" | "USD" | "EUR" | "BRL" | "USDC";
export type SettlementMethod   = "upi" | "imps" | "ach" | "sepa" | "pix" | "card" | "manual";

export interface SettlementRequest {
  // Identity
  paymentId:       string;
  idempotencyKey:  string;
  // Recipient
  recipientId:     string;   // UPI ID · IBAN · routing+account · card token
  recipientName:   string;
  // Amount (fiat output)
  amount:          number;
  currency:        SettlementCurrency;
  method:          SettlementMethod;
  // Source (crypto input)
  sourceAmountUSDC: number;
  txSignature:     string;
  // Routing
  provider:        SettlementProvider;
  // Auth
  userId:          string;
  // Optional extras
  metadata?:       Record<string, unknown>;
}

export interface SettlementResult {
  success:           boolean;
  provider:          SettlementProvider;
  payoutId:          string | null;
  referenceNumber:   string | null;   // UTR (India) · ACH trace · SEPA ref
  estimatedDelivery: string | null;
  feeCharged:        number | null;   // in source currency (USDC)
  error:             string | null;
  retryable:         boolean;
  failureCategory:   string | null;
}

// ── Provider Adapters ─────────────────────────────────────────────────────────

/**
 * Razorpay — India UPI (sandbox available immediately, no KYB)
 *
 * Security: calls /api/razorpay server route — API secret never in browser.
 */
async function settleViaRazorpay(req: SettlementRequest): Promise<SettlementResult> {
  const appUrl = typeof window !== "undefined"
    ? ""                                                    // browser: relative URL resolves correctly
    : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"); // server: need absolute URL

  try {
    const res = await fetch(`${appUrl}/api/razorpay`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount:        req.amount,
        upiId:         req.recipientId,
        recipientName: req.recipientName,
        referenceId:   req.idempotencyKey,
        description:   `Auron · ${req.txSignature.slice(0, 8)}`,
      }),
    });

    const data = await res.json() as {
      success?: boolean; payoutId?: string; utr?: string; status?: string;
      error?: string; errorCode?: string; retryable?: boolean;
    };

    if (!res.ok || !data.success) {
      return {
        success:           false,
        provider:          "razorpay",
        payoutId:          null,
        referenceNumber:   null,
        estimatedDelivery: null,
        feeCharged:        null,
        error:             data.error ?? "Razorpay payout failed",
        retryable:         data.retryable !== false,
        failureCategory:   classifyRazorpayError(data.errorCode),
      };
    }

    return {
      success:           true,
      provider:          "razorpay",
      payoutId:          data.payoutId ?? null,
      referenceNumber:   data.utr ?? null,
      estimatedDelivery: `within ${data.status === "processed" ? "10 seconds" : "5 minutes"}`,
      feeCharged:        req.sourceAmountUSDC * 0.0099, // 0.99% + GST
      error:             null,
      retryable:         false,
      failureCategory:   null,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return {
      success:           false,
      provider:          "razorpay",
      payoutId:          null,
      referenceNumber:   null,
      estimatedDelivery: null,
      feeCharged:        null,
      error:             `Razorpay network error: ${msg}`,
      retryable:         true,
      failureCategory:   "network_error",
    };
  }
}

/** OnMeta — India UPI/IMPS */
async function settleViaOnmeta(req: SettlementRequest): Promise<SettlementResult> {
  const res = await fetch("/api/offramp", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paymentId:      req.paymentId,
      idempotencyKey: req.idempotencyKey,
      usdcAmount:     req.sourceAmountUSDC,
      merchantUpiId:  req.recipientId,
      merchantName:   req.recipientName,
      inrAmount:      req.amount,
      txSignature:    req.txSignature,
      userId:         req.userId,
    }),
  });

  const data = await res.json() as {
    payoutId?: string; utrNumber?: string; error?: string;
    retryable?: boolean; failureCategory?: string;
  };

  if (!res.ok || data.error) {
    return {
      success:           false,
      provider:          "onmeta",
      payoutId:          null,
      referenceNumber:   null,
      estimatedDelivery: null,
      feeCharged:        null,
      error:             data.error ?? "OnMeta payout failed",
      retryable:         data.retryable !== false,
      failureCategory:   data.failureCategory ?? "offramp_rejected",
    };
  }

  return {
    success:           true,
    provider:          "onmeta",
    payoutId:          data.payoutId ?? null,
    referenceNumber:   data.utrNumber ?? null,
    estimatedDelivery: "within 30 seconds",
    feeCharged:        req.sourceAmountUSDC * 0.005,   // 0.5%
    error:             null,
    retryable:         false,
    failureCategory:   null,
  };
}

/** Transak — India / US / EU multi-rail (pending KYB) */
async function settleViaTransak(req: SettlementRequest): Promise<SettlementResult> {
  // TODO: replace with Transak Order API when KYB approved
  // https://docs.transak.com/reference/create-order
  console.warn("[settlement] Transak not yet live — routing to OnMeta fallback");
  return settleViaOnmeta({ ...req, provider: "onmeta" });
}

/** Stripe — US ACH / EU SEPA (pending integration) */
async function settleViaStripe(req: SettlementRequest): Promise<SettlementResult> {
  // TODO: Stripe Connect payout API
  // For now: queue for manual settlement
  console.warn("[settlement] Stripe not yet live — queuing manual settlement");
  return settleManual(req);
}

/** Manual — ops team handles payout via internal tooling */
async function settleManual(req: SettlementRequest): Promise<SettlementResult> {
  // In production: write to a DB queue that ops dashboard reads
  console.info("[settlement] Manual settlement queued:", req.paymentId);
  return {
    success:           true,
    provider:          "manual",
    payoutId:          `manual-${req.paymentId}`,
    referenceNumber:   null,
    estimatedDelivery: "within 1 hour",
    feeCharged:        0,
    error:             null,
    retryable:         false,
    failureCategory:   null,
  };
}

// ── Dispatch table ────────────────────────────────────────────────────────────

const ADAPTERS: Record<SettlementProvider, (req: SettlementRequest) => Promise<SettlementResult>> = {
  onmeta:   settleViaOnmeta,
  razorpay: settleViaRazorpay,
  transak:  settleViaTransak,
  stripe:   settleViaStripe,
  manual:   settleManual,
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Settle a payment via the specified provider.
 * On retryable failure, automatically tries the fallback provider (if supplied).
 */
export async function settlePayment(
  req:      SettlementRequest,
  fallback?: SettlementProvider,
  attempt = 0,
): Promise<SettlementResult> {
  const MAX_AUTO_RETRIES = 1;

  const adapter = ADAPTERS[req.provider] ?? settleManual;
  let result: SettlementResult;

  try {
    result = await adapter(req);
  } catch (err: unknown) {
    result = {
      success:           false,
      provider:          req.provider,
      payoutId:          null,
      referenceNumber:   null,
      estimatedDelivery: null,
      feeCharged:        null,
      error:             err instanceof Error ? err.message : "Unknown settlement error",
      retryable:         true,
      failureCategory:   "network_error",
    };
  }

  // Auto-retry with fallback provider on retryable failure
  if (!result.success && result.retryable && fallback && attempt < MAX_AUTO_RETRIES) {
    console.warn(
      `[settlement] ${req.provider} failed (${result.error}). ` +
      `Retrying with ${fallback}…`
    );
    return settlePayment(
      { ...req, provider: fallback },
      "manual",
      attempt + 1,
    );
  }

  return result;
}

// ── Error Classification ──────────────────────────────────────────────────────

function classifyRazorpayError(errorCode?: string): string {
  if (!errorCode) return "offramp_rejected";
  const code = errorCode.toLowerCase();
  if (code.includes("timeout") || code.includes("gateway"))
    return "offramp_timeout";
  if (code.includes("invalid") || code.includes("upi"))
    return "offramp_rejected";
  if (code.includes("balance") || code.includes("insufficient"))
    return "offramp_rejected";
  return "offramp_rejected";
}
