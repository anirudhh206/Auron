/**
 * Corridor Interface — Auron Settlement Abstraction
 *
 * Every payment rail (UPI/India, PromptPay/Thailand, PIX/Brazil, …) implements
 * this interface. The settlement worker calls the corridor, never a specific provider.
 * Swapping rails = swapping one file, not the orchestration layer.
 */

export type CorridorStatus = "live" | "pending" | "disabled";

export interface CorridorMeta {
  /** Machine-readable corridor key, e.g. "upi_india" */
  id: string;
  /** Display name */
  name: string;
  /** Country this corridor settles into */
  country: string;
  /** ISO-4217 fiat currency delivered to the merchant */
  currency: string;
  /** IETF BCP 47 locale for amount formatting */
  locale: string;
  /** Operational status */
  status: CorridorStatus;
  /** Fee as a decimal fraction — 0.0085 = 0.85% */
  feeRate: number;
  /** p50 settlement time in seconds */
  avgTimeSeconds: number;
  /** Minimum USDC amount this corridor will accept */
  minUsdcAmount: number;
  /** Maximum USDC amount per transaction */
  maxUsdcAmount: number;
}

export interface QuoteRequest {
  /** USDC amount the user is sending */
  usdcAmount: number;
  /** Optional recipient identifier (UPI ID, PromptPay number, PIX key, …) */
  recipientId?: string;
}

export interface QuoteResult {
  /** Fiat amount the merchant receives */
  fiatAmount: number;
  /** Applied FX rate (fiat per USDC) */
  fxRate: number;
  /** Corridor fee in USDC */
  feeUsdc: number;
  /** Unix timestamp when this quote expires */
  expiresAt: number;
  /** Corridor that produced this quote */
  corridorId: string;
}

export interface SettleRequest {
  usdcAmount: number;
  fiatAmount: number;
  fxRate: number;
  recipientId: string;
  recipientName: string;
  paymentId: string;
  idempotencyKey: string;
  txSignature: string;
  userId: string;
}

export interface SettleResult {
  success: boolean;
  /** Provider-assigned payout ID */
  payoutId?: string;
  /** Bank settlement reference (UTR in India, etc.) */
  reference?: string;
  /** Reported status from provider */
  providerStatus?: string;
  error?: string;
  /** Whether this failure is safe to retry */
  retryable?: boolean;
}

export interface RefundRequest {
  paymentId: string;
  userId: string;
  usdcAmount: number;
  reason: string;
}

export interface RefundResult {
  success: boolean;
  txSignature?: string;
  error?: string;
}

/**
 * Every payment corridor must implement this interface.
 * The settlement orchestrator calls these methods without knowing
 * which provider or country is underneath.
 */
export interface PaymentCorridor {
  readonly meta: CorridorMeta;

  /**
   * Returns a live FX quote with TTL.
   * Throws if the corridor is unavailable or rate feed is stale.
   */
  quote(req: QuoteRequest): Promise<QuoteResult>;

  /**
   * Dispatches the fiat settlement to the merchant.
   * Called only after on-chain USDC transfer is verified.
   */
  settle(req: SettleRequest): Promise<SettleResult>;

  /**
   * Triggers an on-chain USDC refund to the user.
   * Called on terminal failures — provider rejection, FX expiry, etc.
   */
  refund(req: RefundRequest): Promise<RefundResult>;

  /**
   * Returns true if this corridor can handle the given recipient identifier.
   * Used to auto-select the correct corridor when the recipient format
   * implies a specific rail (e.g. "name@upi" → UPI India).
   */
  accepts(recipientId: string): boolean;
}
