"use client";

/**
 * useLiveRate — fetches live USDC/INR rate from /api/rate
 * Refreshes every 60 seconds automatically.
 * Falls back to ₹83.15 if the API is unreachable.
 */

import { useState, useEffect, useCallback } from "react";

export const FALLBACK_RATE = 83.15;

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

  const fetchRate = useCallback(async () => {
    try {
      const res = await fetch("/api/rate", { cache: "no-store" });
      if (!res.ok) throw new Error(`Rate API ${res.status}`);
      const data = await res.json() as LiveRate & { fetchedAt?: number };
      setRate({ ...data, fetchedAt: Date.now() });
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch rate";
      setError(msg);
      // Use fallback so UI never blocks
      if (!rate) {
        setRate({
          marketRate: FALLBACK_RATE,
          auronRate: FALLBACK_RATE,
          spreadPercent: "0.85%",
          usdcPer1000Inr: parseFloat((1000 / FALLBACK_RATE).toFixed(6)),
          cached: false,
          fallback: true,
          fetchedAt: Date.now(),
        });
      }
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchRate();
    // Refresh every 60 seconds
    const interval = setInterval(fetchRate, 60_000);
    return () => clearInterval(interval);
  }, [fetchRate]);

  // Convenience: convert INR to USDC using live rate
  function inrToUsdc(inr: number): number {
    const r = rate?.auronRate ?? FALLBACK_RATE;
    return parseFloat((inr / r).toFixed(6));
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
