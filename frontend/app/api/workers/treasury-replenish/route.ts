/**
 * GET /api/workers/treasury-replenish — Treasury USDC→INR Conversion Worker
 *
 * Called by Vercel Cron (e.g. every 6 hours) to convert queued USDC
 * back to INR and replenish the Razorpay X float.
 *
 * When PATH B (Treasury + Razorpay X) is used for a settlement:
 *   - INR is debited from the Razorpay X float immediately
 *   - USDC received is queued in treasury_usdc_queue
 *   - This worker processes that queue and converts USDC → INR
 *   - The converted INR is credited back to treasury_state.inr_available
 *
 * Conversion options (configure via env var TREASURY_CONVERSION_MODE):
 *   "manual"   — log the queue, operator converts manually (default, no KYB needed)
 *   "onmeta"   — use OnMeta's exchange API for conversion (requires OnMeta KYB)
 *   "simulate" — simulate conversion at current FX rate (for testing only)
 *
 * Protected by CRON_SECRET.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getPendingUSDCQueue,
  markUSDCConverted,
  getTreasuryState,
} from "@/lib/treasury";

export const runtime     = "nodejs";
export const maxDuration = 60;

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

  const mode = process.env.TREASURY_CONVERSION_MODE ?? "manual";
  const start = Date.now();

  console.log(`[worker/treasury-replenish] Starting — mode=${mode}`);

  // Get current treasury state
  const state = await getTreasuryState();
  console.log(
    `[worker/treasury-replenish] Treasury: ₹${state?.inrAvailable.toFixed(2) ?? "?"} available, ` +
    `₹${state?.inrReserved.toFixed(2) ?? "?"} reserved, ` +
    `${state?.usdcPending.toFixed(4) ?? "?"} USDC pending`
  );

  // Get all USDC queued for conversion
  const queue = await getPendingUSDCQueue();
  console.log(`[worker/treasury-replenish] ${queue.length} item(s) in conversion queue`);

  if (queue.length === 0) {
    return NextResponse.json({
      message:       "Queue empty — no conversions needed",
      treasuryState: state,
      durationMs:    Date.now() - start,
    });
  }

  const totalUSDC = queue.reduce((sum, item) => sum + item.usdcAmount, 0);
  console.log(`[worker/treasury-replenish] Total USDC to convert: ${totalUSDC.toFixed(4)}`);

  const results = { converted: 0, skipped: 0, failed: 0, totalUSDC, totalINR: 0 };

  if (mode === "simulate") {
    // ── Simulate conversion at live FX rate (testing only) ───────────────────
    const rate = await getLiveFXRate();
    for (const item of queue) {
      const inrAmount = item.usdcAmount * rate;
      await markUSDCConverted(item.id, inrAmount);
      results.converted++;
      results.totalINR += inrAmount;
      console.log(
        `[worker/treasury-replenish] SIMULATED ${item.usdcAmount} USDC → ` +
        `₹${inrAmount.toFixed(2)} @ ₹${rate}/USDC paymentId=${item.paymentId}`
      );
    }

  } else if (mode === "onmeta") {
    // ── Use OnMeta exchange API for real conversion ───────────────────────────
    // OnMeta can convert USDC to INR which gets credited to your OnMeta wallet
    // You then withdraw INR to Razorpay X manually or via API
    // This path requires OnMeta KYB + configured API key
    const apiKey = process.env.ONMETA_API_KEY;
    if (!apiKey) {
      console.warn("[worker/treasury-replenish] ONMETA_API_KEY not set — falling through to manual mode");
      return logManualInstructions(queue, results, start);
    }

    for (const item of queue) {
      try {
        const inrAmount = await convertViaOnMeta(item.usdcAmount, apiKey);
        await markUSDCConverted(item.id, inrAmount);
        results.converted++;
        results.totalINR += inrAmount;
        console.log(
          `[worker/treasury-replenish] OnMeta converted ${item.usdcAmount} USDC → ` +
          `₹${inrAmount.toFixed(2)} paymentId=${item.paymentId}`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown";
        console.error(
          `[worker/treasury-replenish] OnMeta conversion failed paymentId=${item.paymentId}: ${msg}`
        );
        results.failed++;
      }
    }

  } else {
    // ── Manual mode (default — operator converts manually) ───────────────────
    return logManualInstructions(queue, results, start);
  }

  const durationMs = Date.now() - start;
  console.log(
    `[worker/treasury-replenish] Done converted=${results.converted} ` +
    `totalUSDC=${results.totalUSDC.toFixed(4)} totalINR=₹${results.totalINR.toFixed(2)} ` +
    `failed=${results.failed} durationMs=${durationMs}`
  );

  return NextResponse.json({ ...results, durationMs });
}

// ── Manual mode — log instructions for operator ───────────────────────────────

function logManualInstructions(
  queue:   Awaited<ReturnType<typeof getPendingUSDCQueue>>,
  results: Record<string, number>,
  start:   number
) {
  const totalUSDC = queue.reduce((sum, item) => sum + item.usdcAmount, 0);

  console.log("═══════════════════════════════════════════════════════════");
  console.log("[worker/treasury-replenish] MANUAL CONVERSION REQUIRED");
  console.log(`  Total USDC to convert: ${totalUSDC.toFixed(4)} USDC`);
  console.log("  Steps:");
  console.log("  1. Sell USDC on exchange (WazirX / CoinDCX / Binance P2P)");
  console.log(`  2. Receive approximately ₹${(totalUSDC * 84).toFixed(2)} INR`);
  console.log("  3. Transfer INR to your Razorpay X account");
  console.log("  4. Call POST /api/treasury/credit with { inrAmount } to update the ledger");
  console.log("═══════════════════════════════════════════════════════════");
  queue.forEach((item) => {
    console.log(`  paymentId=${item.paymentId} | ${item.usdcAmount} USDC`);
  });

  results.skipped = queue.length;

  return NextResponse.json({
    mode:         "manual",
    message:      "Manual conversion required — see server logs for instructions",
    totalUSDC,
    estimatedINR: totalUSDC * 84,
    queue:        queue.map((i) => ({ paymentId: i.paymentId, usdcAmount: i.usdcAmount })),
    durationMs:   Date.now() - start,
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getLiveFXRate(): Promise<number> {
  try {
    const res  = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=inr",
      { next: { revalidate: 60 } }
    );
    const data = await res.json() as { "usd-coin"?: { inr?: number } };
    return data["usd-coin"]?.inr ?? 84;
  } catch {
    return 84; // fallback rate
  }
}

async function convertViaOnMeta(usdcAmount: number, apiKey: string): Promise<number> {
  // OnMeta exchange endpoint — converts USDC to INR in their system
  // Caller must then withdraw INR to Razorpay X separately
  const res = await fetch("https://api.onmeta.in/v1/exchange/convert", {
    method:  "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify({
      from_currency: "USDC",
      to_currency:   "INR",
      amount:        usdcAmount,
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(`OnMeta exchange error: ${err.message ?? res.statusText}`);
  }

  const data = await res.json() as { inr_amount?: number };
  if (!data.inr_amount) throw new Error("OnMeta exchange: inr_amount missing in response");

  return data.inr_amount;
}
