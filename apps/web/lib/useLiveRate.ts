"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// Driven by env var — never a hardcoded rate
export const FALLBACK_RATE = parseFloat(process.env.NEXT_PUBLIC_FALLBACK_FX_RATE ?? "84.00");

export interface LiveRate {
  marketRate: number;
  auronRate: number;       // rate shown to user (market - spread)
  spreadPercent: string;
  usdcPer1000Inr: number;
  cached: boolean;
  fallback: boolean;       // true if CoinGecko was unreachable
  fetchedAt: number;
}

export function useLiveRate() {
  const [rate, setRate] = useState<LiveRate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track whether we've ever received a good rate so we don't overwrite a live
  // rate with the fallback on a transient network error.
  const hasGoodRateRef = useRef(false);

  const fetchRate = useCallback(async () => {
    try {
      const res = await fetch("/api/rate", { cache: "no-store" });
      if (!res.ok) throw new Error(`Rate API ${res.status}`);
      const data = await res.json() as LiveRate & { fetchedAt?: number };
      hasGoodRateRef.current = true;
      setRate({ ...data, fetchedAt: Date.now() });
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch rate";
      setError(msg);
      // Only apply fallback if we've never received a live rate — preserve the
      // last good rate through transient errors instead of reverting to fallback.
      if (!hasGoodRateRef.current) {
        const spreadPct = parseFloat(process.env.NEXT_PUBLIC_AURON_SPREAD_PERCENT ?? "0.85");
        setRate({
          marketRate: FALLBACK_RATE,
          auronRate: parseFloat((FALLBACK_RATE * (1 - spreadPct / 100)).toFixed(2)),
          spreadPercent: `${spreadPct.toFixed(2)}%`,
          usdcPer1000Inr: Number.parseFloat((1000 / FALLBACK_RATE).toFixed(6)),
          cached: false,
          fallback: true,
          fetchedAt: Date.now(),
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRate();
    // Refresh every 60 seconds
    const interval = setInterval(fetchRate, 60_000);
    return () => clearInterval(interval);
  }, [fetchRate]);

  // Convenience: convert INR to USDC using live rate
  function inrToUsdc(inr: number): number {
    const r = rate?.auronRate ?? FALLBACK_RATE;
    return Number.parseFloat((inr / r).toFixed(6));
  }

  return {
    rate,
    loading,
    error,
    auronRate: rate?.auronRate ?? FALLBACK_RATE,
    inrToUsdc,
    refetch: fetchRate,
  };
}
