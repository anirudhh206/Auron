/**
 * PIX Brazil Corridor — PENDING
 *
 * Schema fully defined. Integration with a Brazilian payment provider (Dock,
 * Celcoin, or Pagar.me) is required before this corridor can go live.
 *
 * PIX keys: CPF (11 digits), CNPJ (14 digits), phone (+55…), email, or random key (UUID).
 * Settlement currency: BRL.
 */

import type { PaymentCorridor, CorridorMeta, QuoteRequest, QuoteResult, SettleRequest, SettleResult, RefundRequest, RefundResult } from "./base";

// PIX key formats
const PIX_CPF_PATTERN    = /^\d{11}$/;
const PIX_CNPJ_PATTERN   = /^\d{14}$/;
const PIX_PHONE_PATTERN  = /^\+55\d{10,11}$/;
const PIX_EMAIL_PATTERN  = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PIX_UUID_PATTERN   = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const NOT_LIVE_ERROR = "PIX corridor is pending — integration not yet live";

export const pixCorridor: PaymentCorridor = {
  meta: {
    id:              "pix_brazil",
    name:            "PIX Brazil",
    country:         "Brazil",
    currency:        "BRL",
    locale:          "pt-BR",
    status:          "pending",
    feeRate:         0.0085,
    avgTimeSeconds:  10,
    minUsdcAmount:   0.5,
    maxUsdcAmount:   5_000,
  },

  accepts(recipientId: string): boolean {
    const id = recipientId.trim();
    return (
      PIX_CPF_PATTERN.test(id)   ||
      PIX_CNPJ_PATTERN.test(id)  ||
      PIX_PHONE_PATTERN.test(id) ||
      PIX_EMAIL_PATTERN.test(id) ||
      PIX_UUID_PATTERN.test(id)
    );
  },

  async quote(_req: QuoteRequest): Promise<QuoteResult> {
    throw new Error(NOT_LIVE_ERROR);
  },

  async settle(_req: SettleRequest): Promise<SettleResult> {
    return { success: false, error: NOT_LIVE_ERROR, retryable: false };
  },

  async refund(_req: RefundRequest): Promise<RefundResult> {
    return { success: false, error: NOT_LIVE_ERROR };
  },
};
