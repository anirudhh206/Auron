/**
 * GET /api/workers/reconcile — Reconciliation Worker
 *
 * Called by Vercel Cron daily at 02:00 UTC.
 * Catches settlements that the main worker started but never finished recording —
 * e.g. worker called OnMeta successfully but crashed before updating the ledger.
 *
 * Strategy:
 *   - Demo settlements: resolve from stored raw_response (no external call needed)
 *   - OnMeta settlements: check provider_payout_id against OnMeta status endpoint
 *   - Stuck "processing" settlements (>10 min): reset to pending for re-attempt
 *   - Completed-but-unrecorded: fix ledger to match provider ground truth
 *   - Critical mismatch (auron=completed, provider=failed): flag for manual review
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getSettlementsForReconciliation,
  updateSettlement,
  transitionTransaction,
  getTransactionById,
} from "@/lib/db/ledger";

export const runtime     = "nodejs";
export const maxDuration = 60;

// ── Auth guard ────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

// ── OnMeta status check ───────────────────────────────────────────────────────

type NormalisedStatus = "completed" | "processing" | "failed";

async function checkOnMetaStatus(
  payoutId: string
): Promise<{ ok: true; status: NormalisedStatus; utr?: string } | { ok: false; error: string }> {
  const apiKey = process.env.ONMETA_API_KEY;

  // Demo mode — no external check possible; treat processing as still in-flight
  if (!apiKey || apiKey === "demo") {
    return { ok: true, status: "processing" };
  }

  try {
    const res = await fetch(`https://api.onmeta.in/v1/offramp/status/${payoutId}`, {
      headers: { "x-api-key": apiKey },
      signal:  AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      return { ok: false, error: `OnMeta ${res.status}: ${res.statusText}` };
    }

    const data = await res.json() as Record<string, unknown>;
    const raw  = String(data.status ?? "processing").toLowerCase();

    const status: NormalisedStatus =
      raw === "completed" || raw === "processed" ? "completed" :
      raw === "failed"    || raw === "rejected"  ? "failed"    :
      "processing";

    return { ok: true, status, utr: data.utr ? String(data.utr) : undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown" };
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start   = Date.now();
  const results = {
    checked:        0,
    alreadyCorrect: 0,
    fixed:          0,
    reset:          0,
    errors:         0,
    discrepancies:  [] as Array<{ settlementId: string; auron: string; provider: string; action: string }>,
  };

  console.log("[worker/reconcile] Starting reconciliation");

  const settlements = await getSettlementsForReconciliation(50);
  console.log(`[worker/reconcile] Checking ${settlements.length} settlement(s)`);

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  for (const settlement of settlements) {
    results.checked++;

    // ── Stuck in "processing" — reset to pending for retry ───────────────────
    if (
      settlement.status === "processing" &&
      settlement.last_checked_at &&
      new Date(settlement.last_checked_at) < tenMinutesAgo
    ) {
      console.warn(`[worker/reconcile] Resetting stuck settlement ${settlement.id}`);
      await updateSettlement(settlement.id, {
        status:          "pending",
        last_checked_at: new Date(),
      });
      results.reset++;
      continue;
    }

    // ── Demo settlements — resolve from raw_response ──────────────────────────
    if (settlement.provider === "demo") {
      const raw    = settlement.raw_response as Record<string, unknown> | null;
      const status = raw?.status as string | undefined;
      if (status === "completed" && settlement.status !== "completed") {
        await updateSettlement(settlement.id, { status: "completed", last_checked_at: new Date() });
        const txn = await getTransactionById(settlement.transaction_id);
        if (txn.ok && txn.data.status !== "completed") {
          await transitionTransaction(txn.data.id, "completed", {
            reason:   "reconciliation: demo settlement resolved from raw_response",
            metadata: { reconciled: true },
          });
        }
        results.fixed++;
      } else {
        await updateSettlement(settlement.id, { last_checked_at: new Date() });
        results.alreadyCorrect++;
      }
      continue;
    }

    // ── OnMeta settlements — check provider status ────────────────────────────
    if (!settlement.provider_payout_id) {
      // No payout ID yet — settlement worker hasn't fired or failed before recording
      await updateSettlement(settlement.id, { last_checked_at: new Date() });
      continue;
    }

    const check = await checkOnMetaStatus(settlement.provider_payout_id);

    if (!check.ok) {
      console.warn(`[worker/reconcile] Status check failed for ${settlement.provider_payout_id}: ${check.error}`);
      await updateSettlement(settlement.id, { last_checked_at: new Date() });
      results.errors++;
      continue;
    }

    await updateSettlement(settlement.id, { last_checked_at: new Date() });

    if (check.status === settlement.status) {
      results.alreadyCorrect++;
      continue;
    }

    // Mismatch
    console.warn(
      `[worker/reconcile] MISMATCH settlement=${settlement.id} ` +
      `auron=${settlement.status} onmeta=${check.status}`
    );

    let action = "none";

    if (check.status === "completed" && settlement.status !== "completed") {
      await updateSettlement(settlement.id, {
        status:          "completed",
        utr:             check.utr,
        last_checked_at: new Date(),
      });
      const txn = await getTransactionById(settlement.transaction_id);
      if (txn.ok && txn.data.status !== "completed") {
        await transitionTransaction(txn.data.id, "completed", {
          reason:   "reconciliation: OnMeta payout confirmed",
          metadata: { reconciled: true, utr: check.utr },
        });
      }
      action = "fixed_completed";
      results.fixed++;

    } else if (check.status === "failed" && settlement.status === "completed") {
      // Critical — we told user success but provider says failed
      console.error(
        `[worker/reconcile] CRITICAL payoutId=${settlement.provider_payout_id} ` +
        `auron=completed onmeta=failed — manual review required`
      );
      action = "flagged_manual_review";
      results.fixed++;

    } else if (check.status === "failed" && settlement.status !== "completed") {
      await updateSettlement(settlement.id, {
        status:          "failed",
        retry_count:     3,             // Prevent further retries
        last_checked_at: new Date(),
      });
      const txn = await getTransactionById(settlement.transaction_id);
      if (txn.ok && txn.data.status !== "completed" && txn.data.status !== "failed") {
        await transitionTransaction(txn.data.id, "failed", {
          reason:          "reconciliation: OnMeta payout failed",
          failureCategory: "offramp_rejected",
          metadata:        { reconciled: true },
        });
      }
      action = "fixed_failed";
      results.fixed++;
    }

    if (action !== "none") {
      results.discrepancies.push({
        settlementId: settlement.id,
        auron:        settlement.status,
        provider:     check.status,
        action,
      });
    }
  }

  const durationMs = Date.now() - start;
  console.log(
    `[worker/reconcile] Done checked=${results.checked} ` +
    `correct=${results.alreadyCorrect} fixed=${results.fixed} ` +
    `reset=${results.reset} errors=${results.errors} durationMs=${durationMs}`
  );

  return NextResponse.json({ ...results, durationMs, ranAt: new Date().toISOString() });
}
