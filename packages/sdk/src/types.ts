/**
 * @auron/sdk — Core Types
 */

// ── Client config ──────────────────────────────────────────────────────────────

export interface AuronConfig {
  /** API key obtained from your Auron dashboard */
  apiKey: string;
  /** Override the base URL (default: production) */
  baseUrl?: string;
  /** Fetch timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
}

// ── Payment ────────────────────────────────────────────────────────────────────

export interface PaymentInput {
  /** Merchant UPI ID — e.g. "merchant@paytm" */
  merchantUpiId: string;
  /** Merchant display name */
  merchantName: string;
  /** Amount in INR (₹) */
  inrAmount: number;
  /**
   * USDC amount to charge.
   * Obtain from `client.getQuote(inrAmount)` before signing the Solana tx.
   */
  usdcAmount: number;
  /**
   * Confirmed Solana transaction signature.
   * Must be a USDC transfer from the user's wallet to the Auron treasury.
   */
  txSignature: string;
  /** User's Solana wallet public key (base58) */
  userId: string;
  /** Optional idempotency key — auto-generated if omitted */
  idempotencyKey?: string;
  /** FX rate used when building the quote (for slippage guard) */
  quoteFxRate?: number;
}

export interface PaymentResponse {
  /** Unique payment ID — use for status polling */
  paymentId: string;
  /** Current status */
  status: PaymentStatus;
  /** USDC amount charged */
  usdcAmount: number;
  /** INR amount settled */
  inrAmount: number;
  /** FX rate used */
  fxRate?: number;
  /** Solana transaction signature */
  txSignature: string;
  /** Bank UTR — available after settlement completes */
  utr?: string;
  /** ISO timestamp */
  createdAt: string;
}

export type PaymentStatus =
  | 'initiated'
  | 'quoted'
  | 'signed'
  | 'verified'
  | 'settling'
  | 'completed'
  | 'failed'
  | 'refunded';

export interface PaymentStatusResponse extends PaymentResponse {
  settlement?: {
    provider: string;
    payoutId?: string;
    utr?: string;
    status: string;
    updatedAt: string;
  };
  history: Array<{
    from: PaymentStatus | null;
    to: PaymentStatus;
    reason: string | null;
    at: string;
  }>;
  updatedAt: string;
}

// ── Quote ──────────────────────────────────────────────────────────────────────

export interface QuoteResponse {
  /** USDC amount to send (inrAmount / fxRate, with spread applied) */
  usdcAmount: number;
  /** Live INR/USDC rate from CoinGecko */
  marketRate: number;
  /** Auron rate after 0.85% spread */
  auronRate: number;
  /** Spread percentage applied */
  spreadPercent: number;
  /** ISO timestamp when the quote was generated */
  quotedAt: string;
  /** Unix ms timestamp when this quote expires (60s TTL) */
  expiresAt: number;
}

// ── Intent parsing ─────────────────────────────────────────────────────────────

export interface ParseIntentOptions {
  /** User identifier for rate limiting (e.g. wallet public key) */
  userId?: string;
  /** User's spend ceiling in INR for security evaluation */
  spendCeiling?: number;
  /** User's 30-day average transaction in INR for anomaly detection */
  thirtyDayAvg?: number;
  /** Whether this is a first payment to this recipient */
  isNewRecipient?: boolean;
}

export interface ParsedIntent {
  /** Action type */
  action: 'transfer' | 'lock' | 'unlock' | 'query' | 'unknown';
  /** Recipient UPI ID or wallet address */
  recipient?: string;
  /** Amount in INR */
  amount?: number;
  /** Duration string (e.g. "30 days") — for lock actions */
  duration?: string;
  /** Confidence score 0–1 */
  confidence: number;
  /** Clarification question if confidence < 0.8 */
  ambiguity?: string;
  /** Human-readable confirmation text */
  confirmText?: string;
}

export interface SecurityFlag {
  type:
    | 'URGENCY_DETECTED'
    | 'EXTREME_AMOUNT'
    | 'NEW_RECIPIENT_LARGE'
    | 'ABOVE_CEILING';
  cooldownSeconds?: number;
  holdDurationMs?: number;
  previewSeconds?: number;
  requiresVoice?: boolean;
}

export interface IntentResponse {
  /** "action" = ready to execute, "clarification" = needs more info */
  type: 'action' | 'clarification';
  /** Structured intent — null when type is "clarification" */
  action: ParsedIntent | null;
  /** Security flags raised by the evaluation pipeline */
  securityFlags: SecurityFlag[];
  /** Human-readable confirmation text */
  confirmText: string | null;
  /** True if a slowdown/cooldown is required before proceeding */
  requiresSlowdown: boolean;
  /** Clarification question (when type is "clarification") */
  question?: string;
}

// ── Polling ────────────────────────────────────────────────────────────────────

export interface WaitOptions {
  /** Polling interval in ms (default: 2000) */
  intervalMs?: number;
  /** Max total wait time in ms (default: 60000) */
  timeoutMs?: number;
  /** Called on each poll with the latest status */
  onPoll?: (status: PaymentStatusResponse) => void;
}
