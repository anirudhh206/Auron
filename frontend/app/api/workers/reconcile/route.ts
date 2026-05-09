/**
 * GET /api/workers/reconcile — Daily Reconciliation Worker
 *
 * Called by Vercel Cron daily at 02:00 UTC.
 * Compares Auron's ledger against Razorpay's ground truth.
 *
 * Why this matters:
 *   Without reconciliation, one Razorpay API bug = lost money.
 *   This is what separates financial infrastructure from CRUD apps.
 *
 * What it does:
 *   1. Fetch all settlements that haven't been checked in the last 24h
 *   2. For each: call GET /v1/payouts/:id on Razorpay
 *   3. Compare Razorpay status to our local status
 *   4. Fix mismatches and log discrepancies
 *
 * Mismatch cases:
 *   - Auron says "pending", Razorpay says "processed" → mark completed, add UTR
 *   - Auron says "completed", Razorpay says "failed" → flag for manual review
 *   - Auron says "processing", Razorpay says unknown → re-query, increment retry
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getSettlementsForReconciliation,
  updateSettlement,
  transitionTransaction,
} from "@/lib/db/ledger";
import crypto from "crypto";

export const runtime     = "nodejs";
export const maxDuration = 60;

// ── Auth guard ────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const authHeader = req.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

// ── Razorpay payout status check ──────────────────────────────────────────────

interface RazorpayPayoutStatus {
  id:          string;
  status:      "queued" | "pending" | "rejected" | "processing" | "processed" | "cancelled" | "failed" | "reversed";
  utr?:        string;
  failure_reason?: string;
  created_at:  number;
}

async function fetchRazorpayPayoutStatus(
  payoutId: string
): Promise<{ ok: true; data: RazorpayPayoutStatus } | { ok: false; error: string }> {
  const keyId    = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    return { ok: false, error: "Razorpay credentials not configured" };
  }

  try {
    const auth = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
    const res  = await fetch(`https://api.razorpay.com/v1/payouts/${payoutId}`, {
      headers: { "Authorization": auth, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as Record<string, unknown>;
      const errObj = err.error as Record<string, unknown> | undefined;
      return { ok: false, error: String(errObj?.description ?? res.statusText) };
    }

    const data = await res.json() as RazorpayPayoutStatus;
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unknown" };
  }
}

// ── Status mapping ────────────────────────────────────────────────────────────

type AuronSettlementStatus = "pending" | "processing" | "completed" | "failed";

function mapRazorpayStatus(rpStatus: string): AuronSettlementStatus {
  switch (rpStatus) {
    case "processed":  return "completed";
    case "processing":
    case "queued":
    case "pending":    return "processing";
    case "failed":
    case "rejected":
    case "cancelled":
    case "reversed":   return "failed";
    default:           return "processing";
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const start = Date.now();
  const results = {
    checked:         0,
    alreadyCorrect:  0,
    fixed:           0,
    discrepancies:   [] as Array<{ settlementId: string; auron: string; razorpay: string; action: string }>,
    errors:          0,
  };

  console.log("[worker/reconcile] Starting reconciliation");

  // Get settlements that need checking
  const settlements = await getSettlementsForReconciliation(50);
  console.log(`[worker/reconcile] Checking ${settlements.length} settlement(s)`);

  // We need transaction data for each settlement — batch fetch via Supabase
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  for (const settlement of settlements) {
    results.checked++;

    if (!settlement.provider_payout_id) {
      // No Razorpay payout ID yet — skip (settlement may still be queued)
      await updateSettlement(settlement.id, { last_checked_at: new Date() });
      continue;
    }

    // ── Fetch ground truth from Razorpay ──────────────────────────────────
    const rpResult = await fetchRazorpayPayoutStatus(settlement.provider_payout_id);

    if (!rpResult.ok) {
      console.warn(
        `[worker/reconcile] Failed to fetch payout ${settlement.provider_payout_id}: ${rpResult.error}`
      );
      await updateSettlement(settlement.id, { last_checked_at: new Date() });
      results.errors++;
      continue;
    }

    const rpData       = rpResult.data;
    const expectedStatus = mapRazorpayStatus(rpData.status);
    const auronStatus    = settlement.status;

    await updateSettlement(settlement.id, { last_checked_at: new Date() });

    if (expectedStatus === auronStatus) {
      results.alreadyCorrect++;
      continue;
    }

    // ── Mismatch detected ─────────────────────────────────────────────────
    console.warn(
      `[worker/reconcile] MISMATCH settlement=${settlement.id} ` +
      `auron=${auronStatus} razorpay=${rpData.status}→${expectedStatus} ` +
      `payoutId=${settlement.provider_payout_id}`
    );

    let action = "unknown";

    if (expectedStatus === "completed" && auronStatus !== "completed") {
      // Razorpay processed it but we didn't record it — fix this
      await updateSettlement(settlement.id, {
        status:             "completed",
        utr:                rpData.utr,
        provider_payout_id: rpData.id,
        raw_response:       rpData as unknown as Record<string, unknown>,
      });

      // Fetch and fix the parent transaction
      const { data: txn } = await supabase
        .from("transactions")
        .select("id, status")
        .eq("id", settlement.transaction_id)
        .single();

      if (txn && txn.status !== "completed") {
        await transitionTransaction(txn.id, "completed", {
          reason: `Reconciliation: Razorpay payout ${rpData.id} was ${rpData.status}`,
          metadata: { reconciled: true, razorpayStatus: rpData.status, utr: rpData.utr },
        });
      }

      action = "fixed_completed";

    } else if (expectedStatus === "failed" && auronStatus === "completed") {
      // ⚠️  Critical: we said success but Razorpay says failed
      // This needs manual review — DO NOT auto-update; flag it
      console.error(
        `[worker/reconcile] CRITICAL DISCREPANCY: auron=completed but razorpay=${rpData.status} ` +
        `payoutId=${settlement.provider_payout_id} failureReason=${rpData.failure_reason}`
      );
      action = "flagged_manual_review";

    } else if (expectedStatus === "failed" && auronStatus !== "completed") {
      // Razorpay failed, we have it as pending/processing — mark failed
      await updateSettlement(settlement.id, {
        status:      "failed",
        retry_count: 3,  // Prevent further retries
        raw_response: rpData as unknown as Record<string, unknown>,
      });

      const { data: txn } = await supabase
        .from("transactions")
        .select("id, status")
        .eq("id", settlement.transaction_id)
        .single();

      if (txn && txn.status !== "completed" && txn.status !== "failed") {
        await transitionTransaction(txn.id, "failed", {
          reason:          `Reconciliation: Razorpay payout ${rpData.id} failed (${rpData.failure_reason})`,
          failureCategory: "offramp_rejected",
          metadata:        { reconciled: true, razorpayStatus: rpData.status },
        });
      }

      action = "fixed_failed";
    }

    results.fixed++;
    results.discrepancies.push({
      settlementId: settlement.id,
      auron:        auronStatus,
      razorpay:     rpData.status,
      action,
    });
  }

  const durationMs = Date.now() - start;
  console.log(
    `[worker/reconcile] Done: checked=${results.checked} ` +
    `correct=${results.alreadyCorrect} fixed=${results.fixed} ` +
    `errors=${results.errors} durationMs=${durationMs}`
  );

  return NextResponse.json({
    ...results,
    durationMs,
    ranAt: new Date().toISOString(),
  });
}
