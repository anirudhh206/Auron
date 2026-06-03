// ─── Security Layer definitions ───────────────────────────────────────────────
// Layer 3: Urgency Detector
const URGENCY_KEYWORDS = [
  "urgent",
  "emergency",
  "right now",
  "please hurry",
  "immediately",
  "they need it",
  "asap",
  "hurry",
  "quick",
  "fast",
  "now",
  "danger",
  "critical",
];

export function detectUrgency(message: string): boolean {
  const lower = message.toLowerCase();
  return URGENCY_KEYWORDS.some((kw) => lower.includes(kw));
}

// Layer 2: Amount anomaly check
export type AmountRisk = "safe" | "above_ceiling" | "extreme" | "new_recipient_large";

export interface SmartLimitResult {
  risk: AmountRisk;
  holdDurationMs: number; // tap-and-hold duration
  requiresVoice: boolean;
  requiresPreview: boolean; // 60s preview notification
}

export function evaluateAmount(
  amount: number,
  ceiling: number,
  thirtyDayAvg: number,
  isNewRecipient: boolean
): SmartLimitResult {
  if (amount >= ceiling * 10 && thirtyDayAvg > 0) {
    return {
      risk: "extreme",
      holdDurationMs: 3000,
      requiresVoice: true,
      requiresPreview: false,
    };
  }
  if (isNewRecipient && amount > ceiling) {
    return {
      risk: "new_recipient_large",
      holdDurationMs: 3000,
      requiresVoice: false,
      requiresPreview: true,
    };
  }
  if (amount > ceiling) {
    return {
      risk: "above_ceiling",
      holdDurationMs: 3000,
      requiresVoice: false,
      requiresPreview: false,
    };
  }
  return {
    risk: "safe",
    holdDurationMs: 0,
    requiresVoice: false,
    requiresPreview: false,
  };
}

// Layer 5: Closed signing — validate contract address is whitelisted
export function isAllowedContract(address: string): boolean {
  const allowed = [
    process.env.NEXT_PUBLIC_TRANSFER_CONTRACT,
    process.env.NEXT_PUBLIC_AGREEMENT_CONTRACT,
    process.env.NEXT_PUBLIC_TIMELOCK_CONTRACT,
    process.env.NEXT_PUBLIC_OWNERSHIP_CONTRACT,
  ].filter(Boolean);
  return allowed.includes(address);
}

export type SecurityFlag =
  | { type: "URGENCY_DETECTED"; cooldownSeconds: 60 }
  | { type: "ABOVE_CEILING"; holdDurationMs: number }
  | { type: "EXTREME_AMOUNT"; holdDurationMs: number; requiresVoice: true }
  | { type: "NEW_RECIPIENT_LARGE"; previewSeconds: 60 }
  | { type: "DAILY_CAP_EXCEEDED" }
  | { type: "UNKNOWN_CONTRACT" };
