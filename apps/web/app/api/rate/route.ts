/**
 * GET /api/rate
 *
 * Returns the live USDC/INR exchange rate from CoinGecko.
 * Auron's rate = market rate minus our spread (default 0.85%) — how we earn revenue.
 *
 * Cached for 60 seconds — rate doesn't need to be real-time for payments.
 * Falls back to hardcoded rate if CoinGecko is unreachable.
 */

import { NextResponse } from "next/server";
import { getLiveRate } from "@/lib/quote";

export const runtime = "nodejs";

// Delegates to getLiveRate() in lib/quote.ts so all server-side code shares one cache.
export async function GET(): Promise<NextResponse> {
  const rate = await getLiveRate();

  return NextResponse.json({
    marketRate:     rate.marketRate,
    auronRate:      rate.auronRate,
    spread:         rate.spreadPercent / 100,
    spreadPercent:  `${rate.spreadPercent.toFixed(2)}%`,
    fallback:       rate.fallback,
    usdcPer1000Inr: parseFloat((1000 / rate.auronRate).toFixed(6)),
  });
}
