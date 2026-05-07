export type PaymentStatus =
  | "idle"
  | "risk_check"           // fraud / risk assessment running
  | "building_tx"          // constructing the Solana transaction
  | "awaiting_signature"   // Phantom modal open
  | "tx_pending"           // tx submitted, waiting for on-chain confirmation
  | "tx_confirmed"         // Solana confirmed — USDC reached Auron treasury
  | "routing"              // selecting best settlement provider
  | "offramp_initiated"    // payout started
  | "offramp_processing"   // provider processing (≤30s)
  | "completed"            // Merchant received INR via UPI — terminal ✓
  | "failed"               // Hard failure — terminal ✗
  | "refund_pending"       // USDC being returned to user
  | "refunded";            // Refund complete — terminal ✓

export const TERMINAL_STATUSES: ReadonlySet<PaymentStatus> = new Set([
  "completed",
  "failed",
  "refunded",
]);

// ─── Failure categories ───────────────────────────────────────────────────────
export type FailureCategory =
  | "tx_rejected_by_user"  // User cancelled in Phantom
  | "tx_simulation_failed" // Insufficient balance or bad instruction
  | "tx_timeout"           // Solana network didn't confirm in time
  | "tx_dropped"           // Tx dropped from mempool
  | "offramp_rejected"     // OnMeta rejected the payout
  | "offramp_timeout"      // OnMeta did not respond
  | "network_error"        // Generic connectivity issue
  | "rate_expired"         // FX quote expired before user confirmed
  | "insufficient_usdc"    // User doesn't have enough USDC
  | "insufficient_sol"     // User doesn't have enough SOL for fees
  | "network_mismatch"     // Phantom is on wrong network (devnet vs mainnet)
  | "unknown";

// ─── Audit event ──────────────────────────────────────────────────────────────
export interface PaymentEvent {
  timestamp: number;          // Unix ms
  status: PaymentStatus;      // New status after this event
  message: string;            // Human-readable description
  data?: Record<string, unknown>; // Any extra context (error, hash, etc.)
}

// ─── Full payment record ──────────────────────────────────────────────────────
export interface PaymentRecord {
  // ── Identity ────────────────────────────────────────────────────────────────
  paymentId: string;          // UUID — Auron internal primary key
  idempotencyKey: string;     // Prevents duplicate offramp calls on retry

  // ── Quote (locked at payment creation) ──────────────────────────────────────
  inrAmount: number;          // INR merchant will receive
  usdcAmount: number;         // USDC user will spend (6 decimal precision)
  fxRate: number;             // ₹/USDC locked at quote time
  quoteExpiresAt: number;     // Unix ms — quote valid for 60 seconds

  // ── Merchant ─────────────────────────────────────────────────────────────────
  merchantUpiId: string;      // e.g. "merchant@paytm"
  merchantName: string;       // display name

  // ── On-chain ─────────────────────────────────────────────────────────────────
  solanaSignature: string | null; // Solana tx signature
  solanaBlockTime: number | null; // Unix ms of on-chain confirmation
  fromAddress: string;            // User's Solana wallet
  toAddress: string;              // Auron treasury address

  // ── Off-ramp ─────────────────────────────────────────────────────────────────
  onmetaPayoutId: string | null;  // OnMeta payout ID
  utrNumber: string | null;       // UPI transaction reference number

  // ── Receipt ──────────────────────────────────────────────────────────────────
  receiptHash: string | null;     // SHA-256 of canonical receipt data (see below)

  // ── Status + audit trail ─────────────────────────────────────────────────────
  status: PaymentStatus;
  events: PaymentEvent[];         // Append-only audit log — never mutate

  // ── Timing ───────────────────────────────────────────────────────────────────
  initiatedAt: number;            // When payment was first created
  confirmedAt: number | null;     // When Solana tx confirmed
  completedAt: number | null;     // When merchant received INR

  // ── Failure ──────────────────────────────────────────────────────────────────
  failureCategory: FailureCategory | null;
  failureReason: string | null;   // Human-readable error
  retryCount: number;             // How many times offramp was retried
  refundTxSignature: string | null; // Solana tx if USDC was refunded
}

// ─── State transitions ────────────────────────────────────────────────────────
export function createPaymentRecord(params: {
  inrAmount: number;
  usdcAmount: number;
  fxRate: number;
  merchantUpiId: string;
  merchantName: string;
  fromAddress: string;
  toAddress: string;
}): PaymentRecord {
  const now = Date.now();
  const paymentId = crypto.randomUUID();

  return {
    paymentId,
    idempotencyKey: `${paymentId}-v1`,
    inrAmount: params.inrAmount,
    usdcAmount: params.usdcAmount,
    fxRate: params.fxRate,
    quoteExpiresAt: now + 60_000, // 60s quote window
    merchantUpiId: params.merchantUpiId,
    merchantName: params.merchantName,
    solanaSignature: null,
    solanaBlockTime: null,
    fromAddress: params.fromAddress,
    toAddress: params.toAddress,
    onmetaPayoutId: null,
    utrNumber: null,
    receiptHash: null,
    status: "idle",
    events: [{
      timestamp: now,
      status: "idle",
      message: `Payment created for ₹${params.inrAmount.toLocaleString("en-IN")} → ${params.merchantUpiId}`,
    }],
    initiatedAt: now,
    confirmedAt: null,
    completedAt: null,
    failureCategory: null,
    failureReason: null,
    retryCount: 0,
    refundTxSignature: null,
  };
}

export function transitionPayment(
  record: PaymentRecord,
  newStatus: PaymentStatus,
  message: string,
  data?: Record<string, unknown>
): PaymentRecord {
  const now = Date.now();
  const event: PaymentEvent = { timestamp: now, status: newStatus, message, data };

  return {
    ...record,
    status: newStatus,
    events: [...record.events, event],
    // Auto-set timing fields on key transitions
    confirmedAt: newStatus === "tx_confirmed" ? now : record.confirmedAt,
    completedAt: newStatus === "completed" ? now : record.completedAt,
  };
}

// ─── Receipt hash ─────────────────────────────────────────────────────────────
// Canonical receipt string — deterministic, verifiable off-chain.
// Anyone can re-compute this and verify Auron's records.
function receiptCanonical(record: PaymentRecord): string {
  return [
    record.paymentId,
    record.solanaSignature ?? "",
    record.usdcAmount.toFixed(6),
    record.inrAmount.toFixed(2),
    record.merchantUpiId,
    record.fromAddress,
    String(record.confirmedAt ?? record.initiatedAt),
  ].join("|");
}

export async function generateReceiptHash(record: PaymentRecord): Promise<string> {
  const canonical = receiptCanonical(record);
  const data = new TextEncoder().encode(canonical);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Liquidity snapshot ───────────────────────────────────────────────────────
export interface LiquiditySnapshot {
  treasuryBalance: number;       // Current USDC in treasury
  inFlightUsdc: number;          // USDC locked in pending payments
  availableUsdc: number;         // treasuryBalance - inFlightUsdc
  minimumReserve: number;        // Alert threshold (configurable)
  isHealthy: boolean;            // availableUsdc >= minimumReserve
  lastCheckedAt: number;
}

export const MINIMUM_TREASURY_RESERVE_USDC = 100; // alert below this

// ─── Display helpers ──────────────────────────────────────────────────────────
export const STATUS_LABELS: Record<PaymentStatus, string> = {
  idle:                "Creating payment",
  risk_check:          "Running security check",
  building_tx:         "Building transaction",
  awaiting_signature:  "Waiting for signature",
  tx_pending:          "Confirming on Solana",
  tx_confirmed:        "Confirmed on-chain",
  routing:             "Selecting best route",
  offramp_initiated:   "Sending to merchant",
  offramp_processing:  "Processing payment",
  completed:           "Payment complete",
  failed:              "Payment failed",
  refund_pending:      "Refund in progress",
  refunded:            "Refunded",
};

export const STATUS_STEPS: PaymentStatus[] = [
  "awaiting_signature",
  "tx_pending",
  "tx_confirmed",
  "offramp_initiated",
  "completed",
];

export function getStepIndex(status: PaymentStatus): number {
  return STATUS_STEPS.indexOf(status);
}

export function isQuoteExpired(record: PaymentRecord): boolean {
  return Date.now() > record.quoteExpiresAt;
}

export function quoteSecondsRemaining(record: PaymentRecord): number {
  return Math.max(0, Math.ceil((record.quoteExpiresAt - Date.now()) / 1000));
}
