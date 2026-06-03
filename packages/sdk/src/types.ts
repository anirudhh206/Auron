/**
 * Auron SDK — Core Types
 */

export interface AuronConfig {
  /** API key (obtain after KYB onboarding) */
  apiKey:   string;
  /** Base URL — defaults to production */
  baseUrl?: string;
}

export interface PaymentRequest {
  /** Merchant UPI ID — e.g. "merchant@paytm" */
  upiId:        string;
  /** Merchant display name */
  merchantName: string;
  /** Amount in INR (₹) */
  inrAmount:    number;
  /** Optional note attached to the payment */
  note?:        string;
}

export interface PaymentResponse {
  /** Unique payment ID — use for status polling */
  paymentId:    string;
  /** Current status */
  status:       PaymentStatus;
  /** USDC amount charged (computed at live rate + 0.85% spread) */
  usdcAmount:   number;
  /** FX rate used */
  fxRate:       number;
  /** Solana transaction signature */
  txSignature?: string;
  /** Bank UTR (available after settlement completes) */
  utr?:         string;
}

export type PaymentStatus =
  | 'initiated'
  | 'quoted'
  | 'signed'
  | 'verified'
  | 'settling'
  | 'completed'
  | 'failed';

export interface PaymentStatusResponse extends PaymentResponse {
  settlement?: {
    provider:  string;
    payoutId?: string;
    utr?:      string;
    status:    string;
    updatedAt: string;
  };
  history: Array<{
    from:   PaymentStatus | null;
    to:     PaymentStatus;
    reason: string | null;
    at:     string;
  }>;
  createdAt: string;
  updatedAt: string;
}
