/**
 * Auron — Razorpay Payout Integration
 *
 * Enterprise-grade settlement via Razorpay Payouts API.
 * Features:
 *   ✓ Idempotency — duplicate requests return cached result
 *   ✓ Error classification — retryable vs non-retryable
 *   ✓ Timeout handling — explicit 15s timeout
 *   ✓ Logging — audit trail for every payout attempt
 *   ✓ Type safety — full request/response types
 *   ✓ Webhook signature verification
 *
 * Environment:
 *   RAZORPAY_KEY_ID     — API key (rzp_test_xxx or rzp_live_xxx)
 *   RAZORPAY_KEY_SECRET — API secret
 *   RAZORPAY_ACCOUNT_ID — Razorpay account number (optional, for test mode)
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RazorpayPayoutRequest {
  amount:         number;    // in INR (₹100 = 100, NOT paise)
  upiId:          string;    // "merchant@paytm"
  recipientName:  string;    // "Merchant Name"
  referenceId:    string;    // Idempotency key (our paymentId)
  description:    string;    // Human-readable description
}

export interface RazorpayPayoutResult {
  success:        boolean;
  payoutId?:      string;    // Razorpay payout ID (pout_xxx)
  utr?:           string;    // UPI transaction reference
  status?:        string;    // "processed" | "pending" | "failed"
  error?:         string;    // Error message
  errorCode?:     string;    // Razorpay error code
  retryable?:     boolean;   // Should caller retry?
}

export interface RazorpayWebhookPayload {
  event:          string;    // "payout.processed" | "payout.failed" | etc
  contains:       string[];  // ["payout"]
  payload: {
    payout: {
      id:         string;
      entity:     string;
      amount:     number;
      status:     string;
      reference_id?: string;
      failure_reason?: string;
      utr?:       string;
      created_at: number;
    };
  };
}

// ── Config ─────────────────────────────────────────────────────────────────────

const RAZORPAY_API_URL = "https://api.razorpay.com/v1";
const PAYOUT_TIMEOUT_MS = 15_000;
const TEST_UPI_ID = "auron-test@okhdfcbank"; // Razorpay test UPI

// ── Payout Cache (in-memory; replace with Redis in production) ──────────────

interface CachedPayout {
  result: RazorpayPayoutResult;
  cachedAt: number;
}
const payoutCache = new Map<string, CachedPayout>();
const PAYOUT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// ── Main Entry Point ───────────────────────────────────────────────────────────

export async function initiateRazorpayPayout(
  req: RazorpayPayoutRequest,
  attempt: number = 1
): Promise<RazorpayPayoutResult> {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    console.error("[razorpay] Missing credentials: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET");
    return {
      success: false,
      error: "Razorpay credentials not configured",
      retryable: false,
    };
  }

  // ── Check cache for idempotency ────────────────────────────────────────────
  const cached = payoutCache.get(req.referenceId);
  if (cached && Date.now() - cached.cachedAt < PAYOUT_CACHE_TTL_MS) {
    console.log(`[razorpay] CACHE HIT referenceId=${req.referenceId} payoutId=${cached.result.payoutId}`);
    return { ...cached.result, success: true };
  }

  console.log(
    `[razorpay] PAYOUT attempt=${attempt} referenceId=${req.referenceId} amount=₹${req.amount} upi=${req.upiId}`
  );

  try {
    // ── Create contact (recipient) ─────────────────────────────────────────────
    const contactResult = await createContact(keyId, keySecret, req);
    if (!contactResult.success) {
      return contactResult;
    }
    const contactId = contactResult.contactId!;

    // ── Create fund account (UPI) ──────────────────────────────────────────────
    const fundAccountResult = await createFundAccount(keyId, keySecret, contactId, req.upiId);
    if (!fundAccountResult.success) {
      return fundAccountResult;
    }
    const fundAccountId = fundAccountResult.fundAccountId!;

    // ── Initiate payout ────────────────────────────────────────────────────────
    const payoutResult = await createPayout(
      keyId,
      keySecret,
      fundAccountId,
      req
    );

    if (payoutResult.success) {
      // Cache the successful result
      payoutCache.set(req.referenceId, {
        result: payoutResult,
        cachedAt: Date.now(),
      });

      console.log(
        `[razorpay] SUCCESS referenceId=${req.referenceId} payoutId=${payoutResult.payoutId} utr=${payoutResult.utr}`
      );
    } else {
      console.error(
        `[razorpay] FAILED referenceId=${req.referenceId} error="${payoutResult.error}" retryable=${payoutResult.retryable}`
      );
    }

    return payoutResult;

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error(`[razorpay] EXCEPTION referenceId=${req.referenceId} error="${msg}"`);

    return {
      success: false,
      error: `Payout exception: ${msg}`,
      retryable: isNetworkError(msg),
    };
  }
}

// ── Webhook Verification ──────────────────────────────────────────────────────

export function verifyRazorpayWebhookSignature(
  body: string,
  signature: string
): boolean {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    console.error("[razorpay] Cannot verify webhook: RAZORPAY_KEY_SECRET not set");
    return false;
  }

  try {
    const crypto = require("crypto");
    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(body)
      .digest("hex");

    const isValid = expectedSignature === signature;
    if (!isValid) {
      console.warn("[razorpay] Webhook signature mismatch");
    }
    return isValid;
  } catch (err) {
    console.error("[razorpay] Webhook signature verification failed:", err);
    return false;
  }
}

// ── Helper: Create Contact ────────────────────────────────────────────────────

async function createContact(
  keyId: string,
  keySecret: string,
  req: RazorpayPayoutRequest
): Promise<{ success: boolean; contactId?: string; error?: string; retryable?: boolean }> {
  try {
    const res = await fetch(`${RAZORPAY_API_URL}/contacts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        type: "customer",
        name: req.recipientName,
        email: `payout-${Date.now()}@auron.local`, // Razorpay requires email
        contact: "9999999999", // Razorpay requires phone; use dummy
        reference_id: req.referenceId,
      }).toString(),
      signal: AbortSignal.timeout(PAYOUT_TIMEOUT_MS),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as Record<string, unknown>;
      const error = (err.error as Record<string, unknown>)?.description ?? res.statusText;
      console.warn(`[razorpay] Contact creation failed: ${error}`);
      return {
        success: false,
        error: String(error),
        retryable: res.status >= 500,
      };
    }

    const data = await res.json() as Record<string, unknown>;
    return {
      success: true,
      contactId: String(data.id ?? ""),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown";
    return {
      success: false,
      error: `Contact creation exception: ${msg}`,
      retryable: isNetworkError(msg),
    };
  }
}

// ── Helper: Create Fund Account (UPI) ─────────────────────────────────────────

async function createFundAccount(
  keyId: string,
  keySecret: string,
  contactId: string,
  upiId: string
): Promise<{ success: boolean; fundAccountId?: string; error?: string; retryable?: boolean }> {
  try {
    const res = await fetch(`${RAZORPAY_API_URL}/fund_accounts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        contact_id: contactId,
        account_type: "vpa",
        "vpa[address]": upiId,
      }).toString(),
      signal: AbortSignal.timeout(PAYOUT_TIMEOUT_MS),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as Record<string, unknown>;
      const error = (err.error as Record<string, unknown>)?.description ?? res.statusText;
      console.warn(`[razorpay] Fund account creation failed: ${error}`);
      return {
        success: false,
        error: String(error),
        retryable: res.status >= 500,
      };
    }

    const data = await res.json() as Record<string, unknown>;
    return {
      success: true,
      fundAccountId: String(data.id ?? ""),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown";
    return {
      success: false,
      error: `Fund account creation exception: ${msg}`,
      retryable: isNetworkError(msg),
    };
  }
}

// ── Helper: Create Payout ─────────────────────────────────────────────────────

async function createPayout(
  keyId: string,
  keySecret: string,
  fundAccountId: string,
  req: RazorpayPayoutRequest
): Promise<RazorpayPayoutResult> {
  try {
    const res = await fetch(`${RAZORPAY_API_URL}/payouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        account_number: "12345678901234", // Razorpay account; optional in test mode
        fund_account_id: fundAccountId,
        amount: String(Math.round(req.amount * 100)), // Convert to paise
        currency: "INR",
        mode: "UPI",
        purpose: "payout",
        reference_id: req.referenceId,
        narration: req.description,
      }).toString(),
      signal: AbortSignal.timeout(PAYOUT_TIMEOUT_MS),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as Record<string, unknown>;
      const errorDesc = (err.error as Record<string, unknown>)?.description ?? res.statusText;
      const errorCode = (err.error as Record<string, unknown>)?.code;

      return {
        success: false,
        error: String(errorDesc),
        errorCode: String(errorCode ?? ""),
        retryable: isRetryableError(String(errorCode ?? ""), res.status),
      };
    }

    const data = await res.json() as Record<string, unknown>;
    return {
      success: true,
      payoutId: String(data.id ?? ""),
      status: String(data.status ?? "processed"),
      utr: String(data.utr ?? data.reference_id ?? ""),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown";
    return {
      success: false,
      error: `Payout creation exception: ${msg}`,
      retryable: isNetworkError(msg),
    };
  }
}

// ── Error Classification ──────────────────────────────────────────────────────

function isRetryableError(errorCode: string, statusCode: number): boolean {
  // Server errors are retryable
  if (statusCode >= 500) return true;

  // Rate limiting
  if (statusCode === 429) return true;
  if (errorCode === "BAD_REQUEST_TOO_MANY_REQUESTS") return true;

  // Timeout-like errors
  if (errorCode === "GATEWAY_TIMEOUT") return true;
  if (errorCode === "SERVICE_UNAVAILABLE") return true;

  // Transient failures
  if (errorCode === "INVALID_STATE_TRANSITION") return false; // Not retryable
  if (errorCode === "INVALID_UPI_HANDLE") return false; // Bad UPI ID
  if (errorCode === "INSUFFICIENT_BALANCE") return false; // Account issue
  if (errorCode === "DUPLICATE_REFERENCE_ID") return false; // Already processed

  // Default: not retryable unless it's a 5xx
  return false;
}

function isNetworkError(message: string): boolean {
  const msg = message.toLowerCase();
  return (
    msg.includes("timeout") ||
    msg.includes("econnrefused") ||
    msg.includes("enotfound") ||
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("socket")
  );
}
