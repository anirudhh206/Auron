/**
 * UPI India Corridor — LIVE
 *
 * Settles USDC → INR via UPI using OnMeta (primary) or Razorpay X (fallback).
 * This is Corridor 1. The architecture supports N corridors; adding a new one
 * means creating a new file implementing PaymentCorridor — nothing else changes.
 */

import type { PaymentCorridor, CorridorMeta, QuoteRequest, QuoteResult, SettleRequest, SettleResult, RefundRequest, RefundResult } from "./base";
import { initiateOnMetaPayout }     from "@/lib/onmeta";
import { executeRefund }              from "@/lib/refund";
import { getTransactionByPaymentId }  from "@/lib/db/ledger";

const QUOTE_TTL_SECONDS = 60;

// UPI ID pattern: localpart@provider
const UPI_PATTERN = /^[\w.\-+]+@[\w]+$/;

export const upiCorridor: PaymentCorridor = {
  meta: {
    id:              "upi_india",
    name:            "UPI India",
    country:         "India",
    currency:        "INR",
    locale:          "en-IN",
    status:          "live",
    feeRate:         0.0085,       // 0.85% blended (OnMeta 0.5% + Auron 0.35%)
    avgTimeSeconds:  20,
    minUsdcAmount:   0.5,
    maxUsdcAmount:   2_500,
  },

  accepts(recipientId: string): boolean {
    return UPI_PATTERN.test(recipientId.trim());
  },

  async quote(req: QuoteRequest): Promise<QuoteResult> {
    // Fetch live INR/USDC rate from the Auron quote engine
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/rate`);
    if (!res.ok) throw new Error(`Rate feed unavailable: ${res.status}`);

    const { rate } = await res.json() as { rate: number };
    if (!rate || rate <= 0) throw new Error("Invalid FX rate received");

    const fee      = req.usdcAmount * this.meta.feeRate;
    const net      = req.usdcAmount - fee;
    const fiatAmt  = Math.floor(net * rate);

    return {
      fiatAmount:  fiatAmt,
      fxRate:      rate,
      feeUsdc:     fee,
      expiresAt:   Math.floor(Date.now() / 1_000) + QUOTE_TTL_SECONDS,
      corridorId:  this.meta.id,
    };
  },

  async settle(req: SettleRequest): Promise<SettleResult> {
    try {
      const result = await initiateOnMetaPayout({
        usdcAmount:    req.usdcAmount,
        merchantUpiId: req.recipientId,
        merchantName:  req.recipientName,
        inrAmount:     req.fiatAmount,
        txSignature:   req.txSignature,
        userId:        req.userId,
      });

      return {
        success:        result.success,
        payoutId:       result.payoutId,
        reference:      result.utrNumber,
        providerStatus: result.status,
        retryable:      true,
      };
    } catch (err) {
      return {
        success:   false,
        error:     err instanceof Error ? err.message : "OnMeta error",
        retryable: true,
      };
    }
  },

  async refund(req: RefundRequest): Promise<RefundResult> {
    try {
      // Look up DB transaction UUID from payment ID
      const txnResult = await getTransactionByPaymentId(req.paymentId);
      if (!txnResult.ok) {
        return { success: false, error: `Payment not found: ${req.paymentId}` };
      }

      const result = await executeRefund({
        transactionId: txnResult.data.id,
        reason:        req.reason,
      });

      return {
        success:      result.success,
        txSignature:  result.refundTxSignature ?? undefined,
        error:        result.error,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "Refund failed",
      };
    }
  },
};
