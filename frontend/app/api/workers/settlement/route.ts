/**
 * GET /api/workers/settlement — Async Settlement Worker
 *
 * Called by Vercel Cron every 30 seconds to drain the pending settlements queue.
 * Also callable manually for testing.
 * Protected by CRON_SECRET in production.
 *
 * TWO SETTLEMENT PATHS:
 *
 *   PATH A — OnMeta (primary):
 *     USDC received → OnMeta API → INR → merchant UPI
 *     OnMeta handles full conversion. No treasury needed.
 *
 *   PATH B — Treasury + Razorpay X (fallback):
 *     USDC received → check INR treasury balance → Razorpay X → merchant UPI
 *     USDC queued for conversion to replenish treasury.
 *     Razorpay X does NOT convert USDC — it dispatches INR from Auron's float.
 *
 * Algorithm:
 *   1. Fetch up to 10 pending settlements
 *   2. For each: atomically claim (optimistic lock prevents double-processing)
 *   3. Try PATH A (OnMeta) first
 *   4. If OnMeta fails + treasury has sufficient INR → try PATH B (Razorpay)
 *   5. On success → mark completed, queue USDC for conversion if PATH B used
 *   6. On failure → increment retry_count; after MAX_RETRIES → mark failed
 */

import { NextRequest, NextResponse }      from "next/server";
import { initiateOnMetaPayout }           from "@/lib/onmeta";
import { initiateRazorpayPayout }         from "@/lib/razorpay";
import {
  canTreasuryCover,
  reserveINR,
  consumeReservation,
  releaseReservation,
  queueUSDCForConversion,
} from "@/lib/treasury";
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
  const results = {
    processed:         0,
    succeeded:         0,
    succeededOnmeta:   0,
    succeededTreasury: 0,
    failed:            0,
    skipped:           0,
  };

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

    // Fetch parent transaction
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

    const settled = await settlePayment(settlement, txn, results);

    if (!settled) {
      // Both paths failed — mark as failed if max retries exceeded
      const newRetryCount = settlement.retry_count + 1;
      const maxed         = newRetryCount >= MAX_RETRIES;

      await updateSettlement(settlement.id, {
        status:          maxed ? "failed" : "pending",
        retry_count:     newRetryCount,
        last_checked_at: new Date(),
        raw_response:    { error: "All settlement paths exhausted", retryCount: newRetryCount },
      });

      if (maxed) {
        await transitionTransaction(txn.id, "failed", {
          reason:          `worker: max retries (${MAX_RETRIES}) exceeded — all paths failed`,
          failureCategory: "offramp_timeout",
        });
      }

      results.failed++;
    }
  }

  const durationMs = Date.now() - start;
  console.log(
    `[worker/settlement] Done processed=${results.processed} ` +
    `succeeded=${results.succeeded} (onmeta=${results.succeededOnmeta} treasury=${results.succeededTreasury}) ` +
    `failed=${results.failed} skipped=${results.skipped} durationMs=${durationMs}`
  );

  return NextResponse.json({ ...results, durationMs });
}

// ── Settlement orchestrator — tries PATH A then PATH B ───────────────────────

async function settlePayment(
  settlement: Awaited<ReturnType<typeof getPendingSettlements>>[number],
  txn: any,
  results: Record<string, number>
): Promise<boolean> {

  // ── PATH A: OnMeta ─────────────────────────────────────────────────────────
  const onmetaSuccess = await tryOnMeta(settlement, txn);
  if (onmetaSuccess) {
    results.succeededOnmeta++;
    results.succeeded++;
    return true;
  }

  console.warn(
    `[worker/settlement] OnMeta failed for paymentId=${txn.payment_id} — ` +
    `checking treasury fallback`
  );

  // ── PATH B: Treasury + Razorpay X ─────────────────────────────────────────
  // Only attempt if:
  //   a) Razorpay X account is configured
  //   b) Treasury has sufficient INR balance
  if (!process.env.RAZORPAY_ACCOUNT_ID) {
    console.log(`[worker/settlement] PATH B skipped — RAZORPAY_ACCOUNT_ID not set`);
    return false;
  }

  const inrAmount = txn.inr_amount as number;
  const canCover  = await canTreasuryCover(inrAmount);

  if (!canCover) {
    console.warn(
      `[worker/settlement] PATH B skipped — insufficient INR treasury for ₹${inrAmount}`
    );
    return false;
  }

  const treasurySuccess = await tryTreasuryRazorpay(settlement, txn);
  if (treasurySuccess) {
    results.succeededTreasury++;
    results.succeeded++;
    return true;
  }

  return false;
}

// ── PATH A: OnMeta ────────────────────────────────────────────────────────────

async function tryOnMeta(
  settlement: any,
  txn: any
): Promise<boolean> {
  try {
    console.log(
      `[worker/settlement] PATH A (OnMeta) paymentId=${txn.payment_id} ` +
      `amount=₹${txn.inr_amount} upi=${txn.merchant_upi_id}`
    );

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
      raw_response:       { ...payoutResult, path: "onmeta" },
    });

    await transitionTransaction(txn.id, "completed", {
      reason: `worker: OnMeta payout ${payoutResult.status} payoutId=${payoutResult.payoutId}`,
    });

    console.log(
      `[worker/settlement] PATH A SUCCESS paymentId=${txn.payment_id} ` +
      `payoutId=${payoutResult.payoutId} utr=${payoutResult.utrNumber ?? "pending"}`
    );

    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown";
    console.error(`[worker/settlement] PATH A FAILED paymentId=${txn.payment_id} error="${msg}"`);
    return false;
  }
}

// ── PATH B: Treasury + Razorpay X ────────────────────────────────────────────

async function tryTreasuryRazorpay(
  settlement: any,
  txn: any
): Promise<boolean> {
  const paymentId = txn.payment_id as string;
  const inrAmount = txn.inr_amount as number;
  const usdcAmount = txn.usdc_amount as number;

  console.log(
    `[worker/settlement] PATH B (Treasury+Razorpay) paymentId=${paymentId} ` +
    `inr=₹${inrAmount} upi=${txn.merchant_upi_id}`
  );

  // Step 1: Reserve INR from treasury
  const reservation = await reserveINR(paymentId, inrAmount);
  if (!reservation.reserved) {
    console.warn(
      `[worker/settlement] PATH B reservation failed paymentId=${paymentId}: ${reservation.reason}`
    );
    return false;
  }

  try {
    // Step 2: Dispatch INR payout via Razorpay X
    // NOTE: Razorpay X sends INR from Auron's pre-funded float.
    //       It does NOT convert USDC. The USDC is queued below for conversion.
    const payoutResult = await initiateRazorpayPayout({
      amount:        inrAmount,
      upiId:         txn.merchant_upi_id,
      recipientName: txn.merchant_name,
      referenceId:   paymentId,
      description:   `Auron payment ${paymentId.slice(0, 8)}`,
    });

    if (!payoutResult.success) {
      // Payout failed — release the INR reservation
      await releaseReservation(paymentId);
      console.error(
        `[worker/settlement] PATH B payout failed paymentId=${paymentId}: ${payoutResult.error}`
      );
      return false;
    }

    // Step 3: Payout succeeded — consume reservation + queue USDC for conversion
    await consumeReservation(paymentId);
    await queueUSDCForConversion(paymentId, usdcAmount);

    // Step 4: Update ledger
    await updateSettlement(settlement.id, {
      status:             "completed",
      provider_payout_id: payoutResult.payoutId,
      utr:                payoutResult.utr,
      last_checked_at:    new Date(),
      raw_response:       {
        ...payoutResult,
        path:              "treasury_razorpay",
        inrFromTreasury:   inrAmount,
        usdcQueuedForConv: usdcAmount,
      },
    });

    await transitionTransaction(txn.id, "completed", {
      reason: `worker: Treasury+Razorpay payout ${payoutResult.status} payoutId=${payoutResult.payoutId} | USDC queued for conversion`,
    });

    console.log(
      `[worker/settlement] PATH B SUCCESS paymentId=${paymentId} ` +
      `payoutId=${payoutResult.payoutId} utr=${payoutResult.utr ?? "pending"} ` +
      `usdcQueued=${usdcAmount}`
    );

    return true;
  } catch (err: unknown) {
    // Unexpected error — release reservation so INR is not stuck
    await releaseReservation(paymentId).catch(() => {});
    const msg = err instanceof Error ? err.message : "Unknown";
    console.error(`[worker/settlement] PATH B EXCEPTION paymentId=${paymentId} error="${msg}"`);
    return false;
  }
}
