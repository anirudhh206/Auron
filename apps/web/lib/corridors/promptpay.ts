/**
 * PromptPay Thailand Corridor — PENDING
 *
 * Schema fully defined. Integration with a Thai payment provider (Omise, 2C2P,
 * or SCB Open Banking) is required before this corridor can go live.
 *
 * PromptPay recipient IDs: 10-digit mobile number or 13-digit national ID.
 * Settlement currency: THB.
 */

import type { PaymentCorridor, CorridorMeta, QuoteRequest, QuoteResult, SettleRequest, SettleResult, RefundRequest, RefundResult } from "./base";

// PromptPay: 10-digit mobile or 13-digit national ID
const PROMPTPAY_MOBILE_PATTERN = /^[0-9]{10}$/;
const PROMPTPAY_NATID_PATTERN  = /^[0-9]{13}$/;

const NOT_LIVE_ERROR = "PromptPay corridor is pending — integration not yet live";

export const promptPayCorridor: PaymentCorridor = {
  meta: {
    id:              "promptpay_thailand",
    name:            "PromptPay Thailand",
    country:         "Thailand",
    currency:        "THB",
    locale:          "th-TH",
    status:          "pending",
    feeRate:         0.0085,
    avgTimeSeconds:  15,
    minUsdcAmount:   0.5,
    maxUsdcAmount:   5_000,
  },

  accepts(recipientId: string): boolean {
    const id = recipientId.replace(/\D/g, "");
    return PROMPTPAY_MOBILE_PATTERN.test(id) || PROMPTPAY_NATID_PATTERN.test(id);
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
