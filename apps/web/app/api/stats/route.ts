/**
 * GET /api/stats — Public settlement statistics
 *
 * Reads from the Supabase ledger and returns aggregated metrics.
 * No authentication required — this is public infrastructure data.
 * Cached for 30 seconds on the CDN.
 */

import { NextResponse } from "next/server";
import { createClient }  from "@supabase/supabase-js";

export const runtime = "nodejs";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

function maskUpi(upi: string | null): string {
  if (!upi) return "—";
  const at = upi.indexOf("@");
  if (at < 3) return upi;
  return upi.slice(0, 3) + "***" + upi.slice(at);
}

export async function GET(): Promise<NextResponse> {
  const supabase = db();

  // Run all queries in parallel
  const [
    { data: txns, error },
    { count: ledgerCount },
    { count: recoveredCount },
    { data: recent },
  ] = await Promise.all([
    // All transactions (lightweight)
    supabase
      .from("transactions")
      .select("id, status, usdc_amount, inr_amount, user_id, created_at, updated_at"),

    // Total ledger entries (status_history rows = every state transition ever)
    supabase
      .from("status_history")
      .select("*", { count: "exact", head: true }),

    // Settlements that had to retry (retry_count > 0 = recovered from failure)
    supabase
      .from("settlements")
      .select("*", { count: "exact", head: true })
      .gt("retry_count", 0),

    // Recent completed settlements with UTR
    supabase
      .from("transactions")
      .select(`
        payment_id,
        merchant_name,
        merchant_upi_id,
        inr_amount,
        usdc_amount,
        tx_signature,
        created_at,
        updated_at,
        settlements ( utr, provider, status, retry_count )
      `)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (error) {
    console.error("[stats] Supabase error:", error.message);
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }

  // ── Compute summary ───────────────────────────────────────────────────────────
  const all       = txns ?? [];
  const completed = all.filter(t => t.status === "completed");
  const failed    = all.filter(t => t.status === "failed");

  const totalUsdc     = completed.reduce((s, t) => s + Number(t.usdc_amount ?? 0), 0);
  const totalInr      = completed.reduce((s, t) => s + Number(t.inr_amount  ?? 0), 0);
  const uniqueWallets = new Set(all.map(t => t.user_id)).size;
  const successRate   = all.length > 0
    ? ((completed.length / all.length) * 100).toFixed(2)
    : "100.00";

  const times = completed
    .filter(t => t.created_at && t.updated_at)
    .map(t =>
      (new Date(t.updated_at as string).getTime() -
       new Date(t.created_at as string).getTime()) / 1000
    );
  const avgSeconds = times.length > 0
    ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
    : 0;

  // ── Shape recent rows ─────────────────────────────────────────────────────────
  type SettlementRow = { utr?: string; provider?: string; status?: string; retry_count?: number };
  const recentRows = (recent ?? []).map(t => {
    const settlement    = (t.settlements as SettlementRow[] | null)?.[0] ?? null;
    const durationSeconds = t.updated_at && t.created_at
      ? Math.round(
          (new Date(t.updated_at as string).getTime() -
           new Date(t.created_at as string).getTime()) / 1000
        )
      : null;
    const utr      = settlement?.utr ?? null;
    const isDemo   = !utr || utr.startsWith("DEMO_") || (t.payment_id as string).startsWith("demo_");
    const retried  = (settlement?.retry_count ?? 0) > 0;
    return {
      payment_id:       t.payment_id,
      merchant_name:    t.merchant_name,
      merchant_upi_id:  maskUpi(t.merchant_upi_id as string | null),
      inr_amount:       t.inr_amount,
      usdc_amount:      t.usdc_amount,
      tx_signature:     t.tx_signature,
      created_at:       t.created_at,
      duration_seconds: durationSeconds,
      utr,
      provider:         settlement?.provider ?? null,
      is_demo:          isDemo,
      // true = this settlement was retried/reconciled before completing
      recovered:        retried,
    };
  });

  const realRows = recentRows.filter(r => !r.is_demo);
  const realUsdc = realRows.reduce((s, r) => s + Number(r.usdc_amount ?? 0), 0);
  const realInr  = realRows.reduce((s, r) => s + Number(r.inr_amount  ?? 0), 0);

  const SPREAD_PERCENT      = 0.85;
  const protocolRevenueUsdc = parseFloat((totalUsdc * SPREAD_PERCENT / 100).toFixed(6));

  return NextResponse.json(
    {
      summary: {
        total_transactions:     all.length,
        completed:              completed.length,
        failed:                 failed.length,
        success_rate:           successRate,        // "99.98" string with 2dp
        total_usdc:             parseFloat(totalUsdc.toFixed(6)),
        total_inr:              parseFloat(totalInr.toFixed(2)),
        verified_usdc:          parseFloat(realUsdc.toFixed(6)),
        verified_inr:           parseFloat(realInr.toFixed(2)),
        unique_wallets:         uniqueWallets,
        avg_settlement_seconds: avgSeconds,
        ledger_entries:         ledgerCount ?? 0,
        recovered_settlements:  recoveredCount ?? 0,
      },
      treasury: {
        protocol_revenue_usdc: protocolRevenueUsdc,
        spread_percent:        SPREAD_PERCENT,
        wallet:                process.env.NEXT_PUBLIC_FEE_WALLET ?? "",
        description:           "USDC accumulated from 0.85% spread on completed payments",
      },
      recent:     recentRows,
      network:    process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet",
      updated_at: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    }
  );
}
