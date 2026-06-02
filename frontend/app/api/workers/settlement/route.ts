/**
 * GET /api/workers/settlement — Async Settlement Worker
 *
 * Called by Vercel Cron every 30 seconds to drain the pending settlements queue.
 * Also callable manually for testing.
 * Protected by CRON_SECRET in production.
 *
 * Phase 1 — OnMeta only:
 *   1. Fetch up to 10 pending settlements
 *   2. Atomically claim each (optimistic lock — no double-processing)
 *   3. Call OnMeta — USDC → INR → merchant UPI
 *   4. On success → mark completed
 *   5. On failure → increment retry_count; after MAX_RETRIES → mark failed
 *
 * Phase 2 (post-grant):
 *   Treasury USDC fallback via secondary offramp when OnMeta fails.
 */

import { NextRequest, NextResponse } from "next/server";
import { initiateOnMetaPayout }      from "@/lib/onmeta";
import {
  getPendingSettlements,
  claimSettlementForProcessing,
  updateSettlement,
  transitionTransaction,
  getTransactionById,
} from "@/lib/db/ledger";

export const runtime     = "nodejs";
export const maxDuration = 60;

const MAX_RETRIES = 3;
const BATCH_SIZE  = 10;

// ── Auth guard ────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start   = Date.now();
  const results = { processed: 0, succeeded: 0, failed: 0, skipped: 0 };

  console.log("[worker/settlement] Starting batch");

  const pending = await getPendingSettlements(BATCH_SIZE);
  console.log(`[worker/settlement] Found ${pending.length} pending settlement(s)`);

  for (const settlement of pending) {
    // Atomically claim — returns null if another worker got there first
    const claimed = await claimSettlementForProcessing(settlement.id, MAX_RETRIES);
    if (!claimed) {
      results.skipped++;
      continue;
    }

    results.processed++;

    const txnResult = await getTransactionById(settlement.transaction_id);
    if (!txnResult.ok) {
      console.error(`[worker/settlement] Transaction not found for settlement ${settlement.id}`);
      await updateSettlement(settlement.id, { status: "failed", retry_count: MAX_RETRIES });
      results.failed++;
      continue;
    }

    const txn = txnResult.data;
    console.log(
      `[worker/settlement] Processing settlement=${settlement.id} ` +
      `paymentId=${txn.payment_id} attempt=${settlement.retry_count + 1}/${MAX_RETRIES}`
    );

    try {
      const payoutResult = await initiateOnMetaPayout({
        usdcAmount:    txn.usdc_amount,
        merchantUpiId: txn.merchant_upi_id,
        merchantName:  txn.merchant_name,
        inrAmount:     txn.inr_amount,
        txSignature:   txn.tx_signature ?? txn.payment_id,
        userId:        txn.user_id,
      });

      await updateSettlement(settlement.id, {
        status:             payoutResult.status === "completed" ? "completed" : "processing",
        provider_payout_id: payoutResult.payoutId,
        utr:                payoutResult.utrNumber,
        last_checked_at:    new Date(),
        raw_response:       payoutResult as unknown as Record<string, unknown>,
      });

      await transitionTransaction(txn.id, "completed", {
        reason: `worker: payout ${payoutResult.status} payoutId=${payoutResult.payoutId}`,
      });

      results.succeeded++;
      console.log(
        `[worker/settlement] SUCCESS paymentId=${txn.payment_id} ` +
        `payoutId=${payoutResult.payoutId} utr=${payoutResult.utrNumber ?? "pending"}`
      );

    } catch (err: unknown) {
      const msg            = err instanceof Error ? err.message : "Unknown";
      const newRetryCount  = settlement.retry_count + 1;
      const isNonRetryable = /invalid upi|upi id|kyc|not found/i.test(msg);
      const maxed          = newRetryCount >= MAX_RETRIES || isNonRetryable;

      console.error(
        `[worker/settlement] FAILED paymentId=${txn.payment_id} ` +
        `attempt=${newRetryCount}/${MAX_RETRIES} error="${msg}" maxed=${maxed}`
      );

      await updateSettlement(settlement.id, {
        status:          maxed ? "failed" : "pending",
        retry_count:     newRetryCount,
        last_checked_at: new Date(),
        raw_response:    { error: msg, retryCount: newRetryCount },
      });

      if (maxed) {
        await transitionTransaction(txn.id, "failed", {
          reason:          `worker: max retries (${MAX_RETRIES}) exceeded — ${msg}`,
          errorMessage:    msg,
          failureCategory: isNonRetryable ? "offramp_rejected" : "offramp_timeout",
        });
      }

      results.failed++;
    }
  }

  const durationMs = Date.now() - start;
  console.log(
    `[worker/settlement] Done processed=${results.processed} ` +
    `succeeded=${results.succeeded} failed=${results.failed} ` +
    `skipped=${results.skipped} durationMs=${durationMs}`
  );

  return NextResponse.json({ ...results, durationMs });
}
