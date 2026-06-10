/**
 * GET /api/workers/settlement — Async Settlement Worker
 *
 * Called by Vercel Cron every 30 seconds to drain the pending settlements queue.
 * Protected by CRON_SECRET in production.
 *
 * Pipeline per settlement:
 *   1. Atomically claim (optimistic lock — no double-processing)
 *   2. Price guard: verify FX rate hasn't moved beyond MAX_SLIPPAGE_BPS
 *   3. Quote expiry check: reject if quote is expired
 *   4. Execute payout via primary provider (OnMeta)
 *   5. On failure: classify → retry / switch provider / auto-refund
 *   6. On terminal failure with switchProvider: retry via Razorpay fallback
 *   7. Log everything to audit trail
 */

import { NextRequest, NextResponse }      from "next/server";
import { initiateOnMetaPayout }           from "@/lib/onmeta";
import { initiateRazorpayPayout, fetchRazorpayPayoutById } from "@/lib/razorpay";
import {
  getPendingSettlements,
  getSettlementsForReconciliation,
  claimSettlementForProcessing,
  updateSettlement,
  createSettlement,
  transitionTransaction,
  getTransactionById,
}                                         from "@/lib/db/ledger";
import { classifyFailure, decideRecovery, checkPriceGuard, isQuoteStillValid } from "@/lib/failure";
import { executeRefund }                  from "@/lib/refund";
import { getLiveRate }                    from "@/lib/quote";

export const runtime     = "nodejs";
export const maxDuration = 60;

const MAX_RETRIES = 3;
const BATCH_SIZE  = 10;

// ── Auth guard ────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // Dev: no secret = open
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start   = Date.now();
  const results = { processed: 0, succeeded: 0, failed: 0, skipped: 0, refunded: 0 };

  console.log("[worker/settlement] Starting batch");

  const pending = await getPendingSettlements(BATCH_SIZE);
  console.log(`[worker/settlement] ${pending.length} pending settlement(s)`);

  for (const settlement of pending) {
    const claimed = await claimSettlementForProcessing(settlement.id, MAX_RETRIES);
    if (!claimed) { results.skipped++; continue; }

    results.processed++;

    const txnResult = await getTransactionById(settlement.transaction_id);
    if (!txnResult.ok) {
      console.error(`[worker/settlement] txn not found for settlement ${settlement.id}`);
      await updateSettlement(settlement.id, { status: "failed", retry_count: MAX_RETRIES });
      results.failed++;
      continue;
    }

    const txn = txnResult.data;
    const tag = `paymentId=${txn.payment_id} attempt=${settlement.retry_count + 1}/${MAX_RETRIES}`;

    // ── Quote expiry check ───────────────────────────────────────────────────
    // Server-side guard: if the DB row has quote_expires_at and it's passed,
    // auto-refund immediately instead of executing a stale settlement.
    const quoteExpiresAt = txn.quote_expires_at ?? null;
    if (quoteExpiresAt && !isQuoteStillValid(new Date(quoteExpiresAt).getTime())) {
      console.warn(`[worker/settlement] Quote expired — initiating refund ${tag}`);
      await _triggerRefund(txn.id, settlement.id, "FX quote expired before settlement executed");
      results.refunded++;
      continue;
    }

    // ── Price slippage guard ─────────────────────────────────────────────────
    if (txn.quote_fx_rate) {
      try {
        const liveRateData = await getLiveRate();
        const guard = checkPriceGuard(Number(txn.quote_fx_rate), liveRateData.auronRate);
        if (!guard.safe) {
          console.warn(`[worker/settlement] Price guard failed — ${guard.reason} — initiating refund ${tag}`);
          await _triggerRefund(
            txn.id, settlement.id,
            `FX rate moved ${guard.slippageBps}bps: ${guard.reason}`
          );
          await updateSettlement(settlement.id, {
            status:       "failed",
            raw_response: { price_guard: guard },
          });
          results.refunded++;
          continue;
        }
      } catch {
        // Rate feed unavailable — proceed (fail-open on price guard)
        console.warn(`[worker/settlement] Price guard skipped (rate feed unavailable) ${tag}`);
      }
    }

    // ── Execute primary provider ─────────────────────────────────────────────
    const providerUsed = settlement.provider ?? txn.provider ?? "onmeta";
    console.log(`[worker/settlement] Processing ${tag} provider=${providerUsed}`);

    try {
      const payoutResult = await _executePayout(providerUsed, txn);

      const hasUtr      = !!payoutResult.utrNumber;
      const isConfirmed = payoutResult.status === "completed" || payoutResult.status === "processed";

      await updateSettlement(settlement.id, {
        status:             hasUtr ? "completed" : "processing",
        provider_payout_id: payoutResult.payoutId ?? undefined,
        utr:                payoutResult.utrNumber ?? undefined,
        last_checked_at:    new Date(),
        raw_response:       payoutResult as unknown as Record<string, unknown>,
      });

      if (hasUtr || isConfirmed) {
        // Only mark the transaction completed once we have a real UTR (or
        // the provider confirmed success without one — e.g. OnMeta).
        await transitionTransaction(txn.id, "completed", {
          reason: `worker: ${providerUsed} payout ${payoutResult.status} id=${payoutResult.payoutId}`,
        });
        results.succeeded++;
        console.log(
          `[worker/settlement] SUCCESS ${tag} payoutId=${payoutResult.payoutId} utr=${payoutResult.utrNumber ?? "none"}`
        );
      } else {
        // Payout created but still queued/processing — UTR not yet assigned.
        // Transaction stays in "settling"; reconciliation loop will poll for UTR.
        console.log(
          `[worker/settlement] QUEUED ${tag} payoutId=${payoutResult.payoutId} status=${payoutResult.status} — awaiting UTR`
        );
        results.succeeded++; // payout was dispatched successfully
      }

    } catch (err: unknown) {
      const msg            = err instanceof Error ? err.message : String(err);
      const retryCount     = settlement.retry_count + 1;
      const classification = classifyFailure(msg);
      const decision       = decideRecovery(classification, retryCount, providerUsed, MAX_RETRIES);

      console.error(
        `[worker/settlement] FAILED ${tag} error="${msg}" ` +
        `classification=${classification.category} decision=${decision.action}`
      );

      await updateSettlement(settlement.id, {
        status:          decision.action === "retry" ? "pending" : "failed",
        retry_count:     retryCount,
        last_checked_at: new Date(),
        raw_response: {
          error:          msg,
          retryCount,
          classification: classification.category,
          decision:       decision.action,
        },
      });

      // ── Recovery actions ────────────────────────────────────────────────────

      if (decision.action === "refund") {
        console.log(`[worker/settlement] Auto-refund triggered ${tag} reason="${classification.internalNote}"`);
        await _triggerRefund(txn.id, settlement.id, classification.internalNote);
        results.refunded++;

      } else if (decision.action === "switch_provider" && decision.nextProvider !== "manual") {
        console.log(`[worker/settlement] Switching to ${decision.nextProvider} ${tag}`);
        const newSettlement = await createSettlement({
          transaction_id: txn.id,
          provider:       decision.nextProvider!,
          status:         "pending",
          raw_response:   { switched_from: providerUsed, reason: decision.reason },
        });
        if (!newSettlement.ok) {
          console.error(`[worker/settlement] Failed to create fallback settlement ${tag}`);
          await _markFailed(txn.id, decision.reason, classification.category);
        }
        results.failed++;

      } else if (decision.action === "abandon" || decision.action === "manual_review") {
        await _markFailed(txn.id, decision.reason, classification.category);
        results.failed++;

      } else {
        // "retry" — settlement already set back to "pending" above
        results.failed++;
      }
    }
  }

  // ── Razorpay UTR reconciliation ──────────────────────────────────────────────
  // Pick up processing Razorpay settlements that have a payoutId but no UTR yet
  // (payouts that were queued on a prior run) and poll Razorpay for their status.
  const reconcile = await getSettlementsForReconciliation(20);
  const rzPending  = reconcile.filter(s => s.provider === "treasury_razorpay" && !s.utr && s.provider_payout_id);

  for (const s of rzPending) {
    const poll = await fetchRazorpayPayoutById(s.provider_payout_id!);
    if (!poll.success || !poll.utr) continue;

    await updateSettlement(s.id, {
      status:          "completed",
      utr:             poll.utr,
      last_checked_at: new Date(),
      raw_response:    poll as unknown as Record<string, unknown>,
    });

    // Now we have the UTR — safe to mark transaction completed
    await transitionTransaction(s.transaction_id, "completed", {
      reason: `razorpay UTR reconciled: ${poll.utr} payoutId=${s.provider_payout_id}`,
    });

    console.log(`[worker/settlement] UTR reconciled settlementId=${s.id} utr=${poll.utr}`);
    results.succeeded++;
  }

  const durationMs = Date.now() - start;
  console.log(
    `[worker/settlement] Done processed=${results.processed} ` +
    `succeeded=${results.succeeded} failed=${results.failed} ` +
    `refunded=${results.refunded} skipped=${results.skipped} durationMs=${durationMs}`
  );

  return NextResponse.json({ ...results, durationMs });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function _executePayout(
  provider: string,
  txn: { usdc_amount: number; merchant_upi_id: string; merchant_name: string; inr_amount: number; tx_signature: string | null; payment_id: string; user_id: string }
) {
  // When OnMeta has no real credentials, fall through to Razorpay so that
  // sandbox testing gets real UTRs instead of demo placeholders.
  const onmetaKey = process.env.ONMETA_API_KEY;
  const effectiveProvider =
    provider === "onmeta" && (!onmetaKey || onmetaKey === "demo")
      ? "treasury_razorpay"
      : provider;

  if (effectiveProvider !== provider) {
    console.log(`[worker/settlement] OnMeta key absent — routing to treasury_razorpay`);
  }

  if (effectiveProvider === "treasury_razorpay") {
    // Razorpay Payout API takes INR amount + UPI ID directly (it's an INR float path)
    const rzResult = await initiateRazorpayPayout({
      amount:        txn.inr_amount,
      upiId:         txn.merchant_upi_id,
      recipientName: txn.merchant_name,
      referenceId:   txn.payment_id,
      description:   `Auron settlement ${txn.payment_id}`,
    });
    if (!rzResult.success) throw new Error(rzResult.error ?? "Razorpay payout failed");
    return {
      status:    rzResult.status ?? "processing",
      payoutId:  rzResult.payoutId ?? null,
      utrNumber: rzResult.utr ?? null,
    };
  }

  // Default: OnMeta — handles full USDC→INR conversion
  return initiateOnMetaPayout({
    usdcAmount:    txn.usdc_amount,
    merchantUpiId: txn.merchant_upi_id,
    merchantName:  txn.merchant_name,
    inrAmount:     txn.inr_amount,
    txSignature:   txn.tx_signature ?? txn.payment_id,
    userId:        txn.user_id,
  });
}

async function _triggerRefund(
  transactionId: string,
  settlementId:  string,
  reason:        string,
): Promise<void> {
  const refundResult = await executeRefund({ transactionId, settlementId, reason });
  if (!refundResult.success) {
    console.error(
      `[worker/settlement] Refund failed transactionId=${transactionId}: ${refundResult.error}`
    );
    // Already handled inside executeRefund — it marks the transaction failed
  }
}

async function _markFailed(
  transactionId:    string,
  reason:           string,
  failureCategory:  string,
): Promise<void> {
  await transitionTransaction(transactionId, "failed", {
    reason,
    errorMessage:    reason,
    failureCategory,
  });
}
