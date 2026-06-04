/**
 * Auron — Failure Classification & Recovery Orchestration
 *
 * Every failure in the settlement pipeline routes through here.
 * The job of this module is to answer three questions:
 *
 *   1. What category is this failure? (classify)
 *   2. Can we retry / switch providers? (recover)
 *   3. Should we automatically refund the user? (refund gate)
 *
 * Nothing in this file calls providers directly. It decides WHAT to do;
 * the settlement worker and reconcile worker carry out the action.
 */

import type { FailureCategory } from "./payment-state";

// ── Severity levels ────────────────────────────────────────────────────────────
export type FailureSeverity = "terminal" | "retryable" | "manual_review";

// ── Extended classification ────────────────────────────────────────────────────
export interface FailureClassification {
  category:       FailureCategory;
  severity:       FailureSeverity;
  retryable:      boolean;
  switchProvider: boolean;   // true = try fallback provider before giving up
  autoRefund:     boolean;   // true = automatically return USDC to user
  userMessage:    string;    // shown to the end user
  internalNote:   string;    // logged internally / ops alert
}

// ── Error pattern → classification map ────────────────────────────────────────
// Order matters: more specific patterns first.
const PATTERNS: Array<{
  match:   RegExp;
  result:  Omit<FailureClassification, "userMessage" | "internalNote">;
  user:    string;
  note:    string;
}> = [
  // ── Non-retryable UPI errors ────────────────────────────────────────────────
  {
    match:  /invalid upi|upi id not found|vpa not found/i,
    result: { category: "offramp_rejected", severity: "terminal",       retryable: false, switchProvider: false, autoRefund: true },
    user:   "The UPI ID was not found. We're refunding your USDC.",
    note:   "Invalid UPI ID — auto-refund triggered",
  },
  {
    match:  /kyc|aml|blacklist/i,
    result: { category: "offramp_rejected", severity: "manual_review",  retryable: false, switchProvider: false, autoRefund: false },
    user:   "This payment requires manual review. Our team will contact you.",
    note:   "KYC/AML block — manual review required",
  },
  {
    match:  /invalid amount|amount too (low|high)|below minimum|above maximum/i,
    result: { category: "offramp_rejected", severity: "terminal",       retryable: false, switchProvider: false, autoRefund: true },
    user:   "Payment amount is outside the allowed range. We're refunding your USDC.",
    note:   "Amount out of range — auto-refund triggered",
  },
  {
    match:  /insufficient (balance|funds|liquidity)/i,
    result: { category: "offramp_rejected", severity: "terminal",       retryable: false, switchProvider: true,  autoRefund: false },
    user:   "Settlement provider has insufficient liquidity. Trying backup route.",
    note:   "Provider liquidity failure — switching provider",
  },
  // ── Provider timeouts / rate limits ─────────────────────────────────────────
  {
    match:  /timeout|timed out|ETIMEDOUT|ECONNRESET/i,
    result: { category: "offramp_timeout",  severity: "retryable",      retryable: true,  switchProvider: false, autoRefund: false },
    user:   "Provider response delayed. Retrying automatically.",
    note:   "Provider timeout — will retry with backoff",
  },
  {
    match:  /rate.?limit|429|too many requests/i,
    result: { category: "offramp_timeout",  severity: "retryable",      retryable: true,  switchProvider: false, autoRefund: false },
    user:   "Provider is busy. Retrying shortly.",
    note:   "Rate limited by provider — retry with backoff",
  },
  // ── Network / infrastructure errors ─────────────────────────────────────────
  {
    match:  /ENOTFOUND|ECONNREFUSED|socket|network|fetch failed/i,
    result: { category: "network_error",    severity: "retryable",      retryable: true,  switchProvider: false, autoRefund: false },
    user:   "Network error. Retrying automatically.",
    note:   "Network connectivity issue — retry",
  },
  // ── Provider 5xx errors ──────────────────────────────────────────────────────
  {
    match:  /5\d\d|internal server|service unavailable|bad gateway/i,
    result: { category: "offramp_timeout",  severity: "retryable",      retryable: true,  switchProvider: true,  autoRefund: false },
    user:   "Provider temporarily unavailable. Trying backup route.",
    note:   "Provider 5xx — retry then switch provider",
  },
  // ── Provider 4xx client errors (non-retryable) ───────────────────────────────
  {
    match:  /4\d\d|bad request|unprocessable/i,
    result: { category: "offramp_rejected", severity: "terminal",       retryable: false, switchProvider: true,  autoRefund: false },
    user:   "Payment rejected. Trying backup route.",
    note:   "Provider 4xx — non-retryable, switch provider",
  },
  // ── Rate / FX expiry ─────────────────────────────────────────────────────────
  {
    match:  /rate.?expir|quote.?expir|fx.?expir|price.?moved/i,
    result: { category: "rate_expired",     severity: "terminal",       retryable: false, switchProvider: false, autoRefund: true },
    user:   "The exchange rate expired before settlement. We're refunding your USDC.",
    note:   "FX rate expired — auto-refund triggered",
  },
  // ── Solana / on-chain errors ─────────────────────────────────────────────────
  {
    match:  /solana|rpc|signature/i,
    result: { category: "tx_timeout",       severity: "retryable",      retryable: true,  switchProvider: false, autoRefund: false },
    user:   "On-chain confirmation delayed. Checking status.",
    note:   "Solana RPC issue — retry verification",
  },
];

// ── Classifier ────────────────────────────────────────────────────────────────

export function classifyFailure(error: Error | string): FailureClassification {
  const message = typeof error === "string" ? error : error.message;

  for (const { match, result, user, note } of PATTERNS) {
    if (match.test(message)) {
      return { ...result, userMessage: user, internalNote: note };
    }
  }

  // Unknown — treat as retryable, switch provider after retries
  return {
    category:       "unknown",
    severity:       "retryable",
    retryable:      true,
    switchProvider: true,
    autoRefund:     false,
    userMessage:    "Settlement encountered an unexpected error. Retrying.",
    internalNote:   `Unclassified error: ${message}`,
  };
}

// ── Recovery decision ─────────────────────────────────────────────────────────

export interface RecoveryDecision {
  action:          "retry" | "switch_provider" | "manual_review" | "refund" | "abandon";
  delayMs:         number;   // how long to wait before next attempt
  nextProvider?:   string;   // which provider to try next
  reason:          string;
}

export function decideRecovery(
  classification: FailureClassification,
  retryCount:     number,
  currentProvider: string,
  maxRetries      = 3,
): RecoveryDecision {

  // Terminal failures with auto-refund
  if (classification.autoRefund) {
    return {
      action:  "refund",
      delayMs: 0,
      reason:  classification.internalNote,
    };
  }

  // Manual review required
  if (classification.severity === "manual_review") {
    return {
      action:  "manual_review",
      delayMs: 0,
      reason:  classification.internalNote,
    };
  }

  // Under retry limit and retryable
  if (classification.retryable && retryCount < maxRetries) {
    // Exponential backoff: 5s → 15s → 45s
    const delayMs = Math.min(5_000 * Math.pow(3, retryCount), 120_000);
    return {
      action:  "retry",
      delayMs,
      reason:  `Retry ${retryCount + 1}/${maxRetries}: ${classification.internalNote}`,
    };
  }

  // Exhausted retries — try switching provider if eligible
  if (classification.switchProvider) {
    const next = currentProvider === "onmeta" ? "treasury_razorpay" : "manual";
    return {
      action:        "switch_provider",
      delayMs:       2_000,
      nextProvider:  next,
      reason:        `Switching from ${currentProvider} to ${next} after ${retryCount} retries`,
    };
  }

  // No path left — abandon (and potentially flag for manual review)
  return {
    action:  "abandon",
    delayMs: 0,
    reason:  `All recovery paths exhausted after ${retryCount} retries: ${classification.internalNote}`,
  };
}

// ── Price change guard ────────────────────────────────────────────────────────
// Called server-side before executing settlement to detect FX slippage.

export interface PriceGuardResult {
  safe:           boolean;
  slippageBps:    number;     // basis points of movement
  quotedRate:     number;
  currentRate:    number;
  reason?:        string;
}

/** Max allowed FX slippage before auto-refunding. 150 bps = 1.5% */
export const MAX_SLIPPAGE_BPS = 150;

export function checkPriceGuard(
  quotedRate:  number,   // INR/USDC rate locked at quote time
  currentRate: number,   // current live rate
): PriceGuardResult {
  if (!quotedRate || !currentRate) {
    // Can't check — let it through (fail-open so a bad rate feed doesn't block payments)
    return { safe: true, slippageBps: 0, quotedRate, currentRate };
  }

  const slippageBps = Math.round(Math.abs(currentRate - quotedRate) / quotedRate * 10_000);
  const safe        = slippageBps <= MAX_SLIPPAGE_BPS;

  return {
    safe,
    slippageBps,
    quotedRate,
    currentRate,
    reason: safe
      ? undefined
      : `FX rate moved ${slippageBps}bps (limit ${MAX_SLIPPAGE_BPS}bps) — ${quotedRate} → ${currentRate}`,
  };
}

// ── Quote expiry guard ────────────────────────────────────────────────────────

export function isQuoteStillValid(quoteExpiresAtMs: number, bufferMs = 5_000): boolean {
  // Buffer: reject quotes that expire within the next 5 seconds — not enough time to settle
  return Date.now() + bufferMs < quoteExpiresAtMs;
}

// ── Stuck payment detector ────────────────────────────────────────────────────
// Used by the reconciliation worker to find payments that haven't moved.

export interface StuckPaymentCriteria {
  status:         string;
  olderThanMs:    number;
  action:         "reset_to_pending" | "flag_manual" | "auto_refund";
}

export const STUCK_PAYMENT_RULES: StuckPaymentCriteria[] = [
  // Settlement claimed but not completed within 10 minutes → reset
  { status: "processing", olderThanMs: 10 * 60 * 1_000, action: "reset_to_pending" },
  // Settling for more than 30 minutes → flag for manual review
  { status: "settling",   olderThanMs: 30 * 60 * 1_000, action: "flag_manual" },
  // Verified but no settlement attempt for more than 15 minutes → flag manual
  { status: "verified",   olderThanMs: 15 * 60 * 1_000, action: "flag_manual" },
];

export function detectStuckPayment(
  status:       string,
  lastUpdatedAt: Date,
): StuckPaymentCriteria | null {
  const ageMs = Date.now() - lastUpdatedAt.getTime();
  return STUCK_PAYMENT_RULES.find(
    r => r.status === status && ageMs > r.olderThanMs
  ) ?? null;
}
