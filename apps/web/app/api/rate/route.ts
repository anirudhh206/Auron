/**
 * GET /api/rate
 *
 * Returns the live USDC/INR exchange rate from CoinGecko.
 * Auron's rate = market rate minus our 0.7% spread (how we earn revenue).
 *
 * Cached for 60 seconds — rate doesn't need to be real-time for payments.
 * Falls back to hardcoded rate if CoinGecko is unreachable.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface RateCache {
  marketRate: number;
  fetchedAt: number;
}

let cache: RateCache | null = null;
const CACHE_TTL_MS = 60_000;
// Spread and fallback driven by env vars — never hardcoded
const AURON_SPREAD         = parseFloat(process.env.AURON_SPREAD_PERCENT  ?? "0.0085");
const FALLBACK_MARKET_RATE = parseFloat(process.env.FALLBACK_FX_RATE_INR  ?? "84.00");

export async function GET(): Promise<NextResponse> {
  // Return cached rate if still fresh
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(buildResponse(cache.marketRate, true));
  }

  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=inr",
      {
        signal: AbortSignal.timeout(5_000),
        headers: { Accept: "application/json" },
        // Next.js: don't cache this fetch — we manage our own cache
        cache: "no-store",
      }
    );

    if (!res.ok) throw new Error(`CoinGecko ${res.status}: ${res.statusText}`);

    const data = await res.json() as { "usd-coin"?: { inr?: number } };
    const marketRate = data["usd-coin"]?.inr;

    // Sanity check — USDC/INR should be between ₹70 and ₹120
    if (!marketRate || marketRate < 70 || marketRate > 120) {
      throw new Error(`Rate out of expected range: ${marketRate}`);
    }

    cache = { marketRate, fetchedAt: Date.now() };
    console.log(`[rate] fetched USDC/INR=${marketRate}`);

    return NextResponse.json(buildResponse(marketRate, false));

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch rate";
    console.error("[rate] CoinGecko error — using fallback:", message);

    // Don't cache the fallback — retry on next request
    return NextResponse.json({
      ...buildResponse(FALLBACK_MARKET_RATE, false),
      fallback: true,
      error: message,
    });
  }
}

function buildResponse(marketRate: number, cached: boolean) {
  const auronRate = parseFloat((marketRate * (1 - AURON_SPREAD)).toFixed(2));
  return {
    marketRate,
    auronRate,          // what user pays: slightly below market (Auron keeps spread)
    spread: AURON_SPREAD,
    spreadPercent: `${(AURON_SPREAD * 100).toFixed(2)}%`,
    cachedAt: cache?.fetchedAt ?? Date.now(),
    cached,
    // Convenience: how many USDC for ₹1000 at Auron rate
    usdcPer1000Inr: parseFloat((1000 / auronRate).toFixed(6)),
  };
}
