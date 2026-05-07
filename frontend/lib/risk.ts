/**
 * Auron Risk Engine
 *
 * Scores every transaction before it hits the blockchain.
 * Score 0–29  → approved, no friction
 * Score 30–69 → approved, show extra confirmation delay
 * Score 70+   → blocked
 *
 * Production extension points (marked TODO):
 *   - Replace BLACKLIST with live sanctions/AML DB lookup
 *   - Replace velocity counters with Redis / edge KV store
 *   - Add ML fraud score from a model trained on tx history
 */

// ── Flags ─────────────────────────────────────────────────────────────────────

export type RiskFlag =
  | "amount_exceeds_single_limit"
  | "amount_exceeds_daily_limit"
  | "velocity_breach"
  | "duplicate_transaction"
  | "new_recipient_large_amount"
  | "recipient_blacklisted"
  | "suspicious_pattern";

// ── Config (easily promoted to env vars / remote config) ─────────────────────

const LIMITS = {
  SINGLE_TX_USDC:          500,    // max single payment
  DAILY_USDC:            2_000,    // rolling 24h cap (USDC)
  DAILY_INR:           166_000,    // rolling 24h cap (INR, ≈ $2000 at ₹83)
  TX_PER_HOUR:              10,    // velocity ceiling
  NEW_RECIPIENT_WARN_USDC: 100,    // flag if new UPI ID + large amount
} as const;

// TODO: replace with live sanctions DB lookup
const BLACKLISTED_RECIPIENTS = new Set([
  "suspicious@paytm",
  "fraud@ybl",
]);

// ── Input / Output types ──────────────────────────────────────────────────────

export interface RiskTransaction {
  userId:          string;
  recipientId:     string;   // UPI ID or wallet address
  amountUSDC:      number;
  amountINR:       number;
  dailySpentUSDC:  number;   // cumulative today before this tx (USDC)
  dailySpentINR?:  number;   // cumulative today before this tx (INR) — preferred for INR payments
  recentTxCount:   number;   // number of txs in the last hour
  isNewRecipient:  boolean;  // first time paying this UPI ID?
  isDuplicate?:    boolean;  // same amount + recipient in last 60s?
}

export interface RiskAssessment {
  score:            number;   // 0 = safe · 100 = hard block
  approved:         boolean;
  blocked:          boolean;
  requiresSlowdown: boolean;  // show 3-second hold + extra confirm step
  flags:            RiskFlag[];
  reason:           string | null;  // human-readable explanation
  limits: {
    singleTx:     number;
    daily:        number;     // USDC daily cap
    dailyINR:     number;     // INR daily cap
    remaining:    number;     // USDC left today after this tx
    remainingINR: number;     // INR left today after this tx
  };
}

// ── Engine ────────────────────────────────────────────────────────────────────

export function assessRisk(tx: RiskTransaction): RiskAssessment {
  const flags: RiskFlag[] = [];
  let score = 0;

  // 1 — Blacklist (hard block)
  if (BLACKLISTED_RECIPIENTS.has(tx.recipientId.toLowerCase())) {
    flags.push("recipient_blacklisted");
    score += 100;
  }

  // 2 — Single tx limit
  if (tx.amountUSDC > LIMITS.SINGLE_TX_USDC) {
    flags.push("amount_exceeds_single_limit");
    score += 40;
  }

  // 3 — Daily limit (prefer INR comparison for UPI payments, fall back to USDC)
  const dailyLimitBreached = tx.dailySpentINR !== undefined
    ? tx.dailySpentINR + tx.amountINR > LIMITS.DAILY_INR
    : tx.dailySpentUSDC + tx.amountUSDC > LIMITS.DAILY_USDC;
  if (dailyLimitBreached) {
    flags.push("amount_exceeds_daily_limit");
    score += 50;
  }

  // 4 — Velocity
  if (tx.recentTxCount >= LIMITS.TX_PER_HOUR) {
    flags.push("velocity_breach");
    score += 30;
  }

  // 5 — New recipient + large amount
  if (tx.isNewRecipient && tx.amountUSDC > LIMITS.NEW_RECIPIENT_WARN_USDC) {
    flags.push("new_recipient_large_amount");
    score += 20;
  }

  // 6 — Duplicate detection
  if (tx.isDuplicate) {
    flags.push("duplicate_transaction");
    score += 25;
  }

  const capped   = Math.min(score, 100);
  const blocked  = capped >= 70;
  const approved = !blocked;
  const requiresSlowdown = capped >= 30 && !blocked;

  return {
    score:            capped,
    approved,
    blocked,
    requiresSlowdown,
    flags,
    reason: flags.length > 0 ? getRiskReason(flags[0]) : null,
    limits: {
      singleTx:     LIMITS.SINGLE_TX_USDC,
      daily:        LIMITS.DAILY_USDC,
      dailyINR:     LIMITS.DAILY_INR,
      remaining:    Math.max(0, LIMITS.DAILY_USDC - tx.dailySpentUSDC - tx.amountUSDC),
      remainingINR: Math.max(0, LIMITS.DAILY_INR - (tx.dailySpentINR ?? 0) - tx.amountINR),
    },
  };
}

// ── Human-readable reasons ────────────────────────────────────────────────────

const RISK_REASONS: Record<RiskFlag, string> = {
  amount_exceeds_single_limit:
    `Single transaction limit is $${LIMITS.SINGLE_TX_USDC} USDC. Split into smaller payments.`,
  amount_exceeds_daily_limit:
    `This would exceed your daily limit of $${LIMITS.DAILY_USDC} USDC. Try again tomorrow.`,
  velocity_breach:
    "Too many transactions in a short period. Please wait a few minutes before retrying.",
  duplicate_transaction:
    "A similar transaction was detected in the last 60 seconds. Please confirm this is intentional.",
  new_recipient_large_amount:
    "Large payment to a new recipient — please double-check the UPI ID before confirming.",
  recipient_blacklisted:
    "This recipient has been flagged for suspicious activity and cannot receive payments.",
  suspicious_pattern:
    "Unusual payment pattern detected. Please contact support if this is a legitimate transaction.",
};

function getRiskReason(flag: RiskFlag): string {
  return RISK_REASONS[flag] ?? "Transaction flagged for review.";
}
