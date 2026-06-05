/**
 * GET /api/receipt/:paymentId
 *
 * Returns a fully replayable, cryptographically verifiable receipt for any
 * completed (or refunded) payment.
 *
 * The receipt contains:
 *   - Auron internal payment_id
 *   - Solana on-chain tx signature (the proof the USDC moved)
 *   - on-chain block timestamp
 *   - INR amount + USDC amount + FX rate locked at quote time
 *   - Merchant UPI ID + UTR (UPI Transaction Reference)
 *   - receipt_hash: SHA-256 of canonical fields — verifiable off-chain
 *   - Full status history (audit trail)
 *
 * Verification:
 *   Anyone can recompute the receipt_hash from the canonical fields and
 *   confirm it matches — proving the data has not been altered.
 *
 * Public endpoint — no auth required (payment_id is already a secret).
 */

import { NextRequest, NextResponse } from "next/server";
import { getTransactionWithSettlement } from "@/lib/db/ledger";
import { generateReceiptHash } from "@/lib/payment-state";
import type { PaymentRecord } from "@/lib/payment-state";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
): Promise<NextResponse> {
  const { paymentId } = await params;

  if (!paymentId || typeof paymentId !== "string") {
    return NextResponse.json({ error: "Invalid payment ID" }, { status: 400 });
  }

  // Fetch transaction + settlement + history in one round-trip
  const result = await getTransactionWithSettlement(paymentId);

  if (!result.ok) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  const { settlement, history, ...txn } = result.data;

  // Generate receipt hash from canonical fields
  // Build a minimal PaymentRecord compatible with generateReceiptHash
  const pseudoRecord: Partial<PaymentRecord> & {
    paymentId: string;
    solanaSignature: string | null;
    usdcAmount: number;
    inrAmount: number;
    merchantUpiId: string;
    fromAddress: string;
    confirmedAt: number | null;
    initiatedAt: number;
  } = {
    paymentId:       txn.payment_id,
    solanaSignature: txn.tx_signature ?? null,
    usdcAmount:      Number(txn.usdc_amount),
    inrAmount:       Number(txn.inr_amount),
    merchantUpiId:   txn.merchant_upi_id,
    fromAddress:     txn.user_id,
    confirmedAt:     txn.tx_block_time ? new Date(txn.tx_block_time).getTime() : null,
    initiatedAt:     new Date(txn.created_at).getTime(),
  };

  // Compute hash
  const computedHash = await generateReceiptHash(pseudoRecord as PaymentRecord);

  // Build the receipt object — every field is a verifiable artefact
  const receipt = {
    // ── Identity ──────────────────────────────────────────────────────────────
    payment_id:          txn.payment_id,
    internal_id:         txn.id,

    // ── On-chain proof ────────────────────────────────────────────────────────
    on_chain_hash:       txn.tx_signature ?? null,
    on_chain_timestamp:  txn.tx_block_time ?? null,
    network:             process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet",

    // ── Amounts ───────────────────────────────────────────────────────────────
    usdc_amount:         Number(txn.usdc_amount),
    inr_amount:          Number(txn.inr_amount),
    fx_rate:             txn.quote_fx_rate ? Number(txn.quote_fx_rate) : null,

    // ── Parties ───────────────────────────────────────────────────────────────
    from_wallet:         txn.user_id,
    merchant_upi_id:     txn.merchant_upi_id,
    merchant_name:       txn.merchant_name,

    // ── Settlement details ────────────────────────────────────────────────────
    utr_number:          settlement?.utr ?? null,
    provider:            settlement?.provider ?? txn.provider ?? null,
    provider_payout_id:  settlement?.provider_payout_id ?? null,

    // ── Refund info (if applicable) ───────────────────────────────────────────
    refund_tx_signature: (txn as Record<string, unknown>).refund_tx_signature as string | null ?? null,
    refund_reason:       (txn as Record<string, unknown>).refund_reason as string | null ?? null,

    // ── Status ────────────────────────────────────────────────────────────────
    status:              txn.status,

    // ── Timestamps ───────────────────────────────────────────────────────────
    initiated_at:        txn.created_at,
    last_updated_at:     txn.updated_at,

    // ── Integrity hash ────────────────────────────────────────────────────────
    receipt_hash:        computedHash,

    // ── Audit trail (full state machine history) ──────────────────────────────
    audit_trail: history.map(h => ({
      from_status: h.from_status,
      to_status:   h.to_status,
      reason:      h.reason,
      metadata:    h.metadata,
      timestamp:   h.created_at,
    })),

    // ── Verification instructions ────────────────────────────────────────────
    verify: {
      instructions: "To verify this receipt, recompute SHA-256 of the canonical string:",
      canonical_format: "payment_id|on_chain_hash|usdc_amount(6dp)|inr_amount(2dp)|merchant_upi_id|from_wallet|confirmed_at_ms",
      canonical_example: [
        txn.payment_id,
        txn.tx_signature ?? "",
        Number(txn.usdc_amount).toFixed(6),
        Number(txn.inr_amount).toFixed(2),
        txn.merchant_upi_id,
        txn.user_id,
        txn.tx_block_time
          ? String(new Date(txn.tx_block_time).getTime())
          : String(new Date(txn.created_at).getTime()),
      ].join("|"),
      on_chain_explorer: txn.tx_signature
        ? `https://solscan.io/tx/${txn.tx_signature}?cluster=${process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet"}`
        : null,
    },
  };

  return NextResponse.json(receipt, {
    headers: {
      // Cache completed/refunded receipts for 5 minutes — they're immutable
      "Cache-Control": ["completed", "refunded"].includes(txn.status)
        ? "public, max-age=300, stale-while-revalidate=60"
        : "no-store",
    },
  });
}
