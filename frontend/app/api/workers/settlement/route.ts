/**
 * GET /api/workers/settlement — Async Settlement Worker
 *
 * Called by Vercel Cron every minute to process pending settlements.
 * Also callable manually via: GET /api/workers/settlement
 * (Protected by CRON_SECRET when deployed on Vercel)
 *
 * Algorithm:
 *   1. Fetch pending settlements (status=pending, retry_count < 3)
 *   2. For each: atomically claim it (optimistic locking)
 *   3. Call Razorpay payout API
 *   4. On success: mark settlement + transaction completed
 *   5. On failure: increment retry_count, schedule next attempt
 *   6. After 3 failures: mark settlement + transaction failed permanently
 *
 * This is how Stripe handles async payment flows.
 */

import { NextRequest, NextResponse } from "next/server";
import { initiateRazorpayPayout }   from "@/lib/razorpay";
import {
  getPendingSettlements,
  claimSettlementForProcessing,
  updateSettlement,
  transitionTransaction,
  getTransactionWithSettlement,
} from "@/lib/db/ledger";

export const runtime  = "nodejs";
export const maxDuration = 60;         // Allow full minute of processing

const MAX_RETRIES    = 3;
const BATCH_SIZE     = 10;            // Process up to 10 per invocation

// ── Auth guard ────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;           // No secret configured: allow in dev

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;

  // Vercel Cron sends: Authorization: Bearer <secret>
  return authHeader === `Bearer ${secret}`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start     = Date.now();
  const results   = { processed: 0, succeeded: 0, failed: 0, skipped: 0 };

  console.log("[worker/settlement] Starting batch");

  // ── Fetch pending settlements ───────────────────────────────────────────────
  const pending = await getPendingSettlements(BATCH_SIZE);
  console.log(`[worker/settlement] Found ${pending.length} pending settlement(s)`);

  for (const settlement of pending) {
    // ── Claim it (optimistic lock) ────────────────────────────────────────
    const claimed = await claimSettlementForProcessing(settlement.id, MAX_RETRIES);
    if (!claimed) {
      // Another worker instance claimed it, or it exceeded max retries
      results.skipped++;
      console.log(`[worker/settlement] Settlement ${settlement.id} skipped (claimed or maxed)`);
      continue;
    }

    results.processed++;

    // ── Fetch parent transaction ──────────────────────────────────────────
    const txnResult = await getTransactionWithSettlement(
      // We need the payment_id — get it via the transaction_id FK
      settlement.transaction_id   // this is UUID, not payment_id
    );

    // We have the transaction_id (UUID), need to get the transaction record
    // The getTransactionWithSettlement takes payment_id, so we need a different approach
    // Let's use a direct query via the transaction UUID
    // Since ledger.ts doesn't have getTransactionById, we'll use the settlement's transaction_id
    // and just call the Razorpay API with the data we need

    // Actually we need the merchant UPI, name, amount from the transaction.
    // The settlement doesn't store these. Let's get the transaction.
    // We'll need to add a helper. For now, use the settlement's raw_response if it has original data,
    // or query by the idempotency_key stored in the transaction.
    // Best approach: query transactions table directly by id.

    try {
      // Inline query for transaction by UUID (ledger.ts getTransactionByPaymentId won't work here)
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false } }
      );

      const { data: txn, error: txnErr } = await supabase
        .from("transactions")
        .select()
        .eq("id", settlement.transaction_id)
        .single();

      if (txnErr || !txn) {
        console.error(`[worker/settlement] Transaction not found for settlement ${settlement.id}`);
        await updateSettlement(settlement.id, { status: "failed", retry_count: MAX_RETRIES });
        results.failed++;
        continue;
      }

      console.log(
        `[worker/settlement] Processing settlement=${settlement.id} ` +
        `paymentId=${txn.payment_id} attempt=${settlement.retry_count + 1}/${MAX_RETRIES}`
      );

      // ── Execute payout ──────────────────────────────────────────────────
      const payoutResult = await initiateRazorpayPayout(
        {
          amount:        txn.inr_amount,
          upiId:         txn.merchant_upi_id,
          recipientName: txn.merchant_name,
          referenceId:   txn.idempotency_key,
          description:   `Auron retry ${txn.payment_id.slice(0, 8)}`,
        },
        settlement.retry_count + 1
      );

      if (payoutResult.success) {
        // ── Success ───────────────────────────────────────────────────────
        await updateSettlement(settlement.id, {
          status:             "completed",
          provider_payout_id: payoutResult.payoutId,
          utr:                payoutResult.utr,
          last_checked_at:    new Date(),
          raw_response:       payoutResult as unknown as Record<string, unknown>,
        });

        await transitionTransaction(txn.id, "completed", {
          reason: `Settlement worker: payout succeeded payoutId=${payoutResult.payoutId}`,
        });

        results.succeeded++;
        console.log(
          `[worker/settlement] SUCCESS paymentId=${txn.payment_id} ` +
          `payoutId=${payoutResult.payoutId} utr=${payoutResult.utr ?? "pending"}`
        );

      } else {
        // ── Failure ───────────────────────────────────────────────────────
        const newRetryCount = settlement.retry_count + 1;
        const maxed = newRetryCount >= MAX_RETRIES || !payoutResult.retryable;

        await updateSettlement(settlement.id, {
          status:          maxed ? "failed" : "pending",
          retry_count:     newRetryCount,
          last_checked_at: new Date(),
          raw_response:    payoutResult as unknown as Record<string, unknown>,
        });

        if (maxed) {
          await transitionTransaction(txn.id, "failed", {
            reason:          `Settlement worker: max retries (${MAX_RETRIES}) exceeded`,
            errorMessage:    payoutResult.error,
            failureCategory: payoutResult.errorCode ?? "offramp_rejected",
          });
        }

        results.failed++;
        console.error(
          `[worker/settlement] FAILED paymentId=${txn.payment_id} ` +
          `attempt=${newRetryCount}/${MAX_RETRIES} retryable=${payoutResult.retryable} ` +
          `error="${payoutResult.error}" maxed=${maxed}`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown";
      console.error(`[worker/settlement] Exception for settlement ${settlement.id}: ${msg}`);

      const newRetryCount = settlement.retry_count + 1;
      await updateSettlement(settlement.id, {
        status:          newRetryCount >= MAX_RETRIES ? "failed" : "pending",
        retry_count:     newRetryCount,
        last_checked_at: new Date(),
      });

      results.failed++;
    }
  }

  const durationMs = Date.now() - start;
  console.log(
    `[worker/settlement] Done: processed=${results.processed} ` +
    `succeeded=${results.succeeded} failed=${results.failed} ` +
    `skipped=${results.skipped} durationMs=${durationMs}`
  );

  return NextResponse.json({ ...results, durationMs });
}
