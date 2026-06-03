/**
 * GET /api/v1/payment/:id — Payment Status & Receipt
 *
 * Poll this endpoint after calling POST /api/v1/pay to get
 * real-time status updates from the persistent ledger.
 *
 * Returns the full transaction record, its latest settlement,
 * and the complete status history (audit trail).
 *
 * Response shape:
 *   {
 *     paymentId:    "pay_...",
 *     status:       "completed" | "settling" | "failed" | ...,
 *     settlement: {
 *       provider:   "razorpay",
 *       utr:        "HDFC1234567890",
 *       status:     "completed",
 *     },
 *     history: [
 *       { from: null, to: "initiated", at: "2025-01-01T00:00:00Z" },
 *       { from: "initiated", to: "verified", at: "..." },
 *       ...
 *     ]
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { getTransactionWithSettlement } from "@/lib/db/ledger";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const paymentId = id?.trim();

  if (!paymentId) {
    return NextResponse.json({ error: "payment ID is required" }, { status: 400 });
  }

  const result = await getTransactionWithSettlement(paymentId);

  if (!result.ok) {
    const notFound = result.error.includes("Not found") || result.error.includes("PGRST116");
    return NextResponse.json(
      { error: notFound ? "Payment not found" : result.error },
      { status: notFound ? 404 : 500 }
    );
  }

  const { settlement, history, ...txn } = result.data;

  // Shape the response to be clean and client-friendly
  return NextResponse.json({
    paymentId:    txn.payment_id,
    status:       txn.status,
    inrAmount:    txn.inr_amount,
    usdcAmount:   txn.usdc_amount,
    quoteFxRate:  txn.quote_fx_rate,
    merchantUpiId: txn.merchant_upi_id,
    merchantName:  txn.merchant_name,
    txSignature:  txn.tx_signature,
    provider:     txn.provider,
    failureCategory: txn.failure_category,
    errorMessage: txn.error_message,
    retryCount:   txn.retry_count,

    settlement: settlement ? {
      id:         settlement.id,
      provider:   settlement.provider,
      payoutId:   settlement.provider_payout_id,
      utr:        settlement.utr,
      status:     settlement.status,
      retryCount: settlement.retry_count,
      updatedAt:  settlement.updated_at,
    } : null,

    history: history.map((h) => ({
      from:   h.from_status,
      to:     h.to_status,
      reason: h.reason,
      at:     h.created_at,
    })),

    createdAt: txn.created_at,
    updatedAt: txn.updated_at,
  });
}
