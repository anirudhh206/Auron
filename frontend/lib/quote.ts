/**
 * Auron Quote Engine
 *
 * Quote authority lives HERE — not in Claude's prompt.
 * Claude parses intent (merchant, INR amount, UPI ID).
 * The quote engine computes the USDC amount, FX rate, spread, and expiry.
 *
 * This file runs both client-side (for TTL checks) and server-side (for creation).
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Quote {
  quoteId:       string;
  // Amounts
  inrAmount:     number;   // merchant receives exactly this in INR
  usdcAmount:    number;   // user pays exactly this in USDC (6 decimal precision)
  // Pricing
  marketRate:    number;   // raw CoinGecko rate (₹ per 1 USDC)
  auronRate:     number;   // after spread (₹ per 1 USDC, what user gets)
  spreadPercent: number;   // e.g. 0.85
  // Merchant
  merchantUpiId: string;
  merchantName:  string;
  // Lifecycle
  quoteId_:      string;   // alias — keep both for compat
  expiresAt:     number;   // Unix ms — stale after this
  createdAt:     number;
}

// ── Config ────────────────────────────────────────────────────────────────────

export const QUOTE_TTL_MS      = 60_000;
export const SPREAD_PERCENT    = parseFloat(process.env.AURON_SPREAD_PERCENT  ?? "0.85");
export const FALLBACK_RATE_INR = parseFloat(process.env.FALLBACK_FX_RATE_INR  ?? "84.00");

// ── Factory ───────────────────────────────────────────────────────────────────

export function buildQuote(params: {
  inrAmount:     number;
  merchantUpiId: string;
  merchantName:  string;
  marketRate:    number;   // live rate from /api/rate
}): Quote {
  const { inrAmount, merchantUpiId, merchantName, marketRate } = params;

  // Apply Auron's spread to give users a slightly lower rate than market
  const auronRate   = parseFloat((marketRate * (1 - SPREAD_PERCENT / 100)).toFixed(6));
  const usdcAmount  = parseFloat((inrAmount / auronRate).toFixed(6));
  const now         = Date.now();
  const id          = crypto.randomUUID();

  return {
    quoteId:       id,
    quoteId_:      id,
    inrAmount,
    usdcAmount,
    marketRate,
    auronRate,
    spreadPercent: SPREAD_PERCENT,
    merchantUpiId,
    merchantName,
    expiresAt:     now + QUOTE_TTL_MS,
    createdAt:     now,
  };
}

// ── Validity helpers ──────────────────────────────────────────────────────────

export function isQuoteStale(quote: Quote): boolean {
  return Date.now() > quote.expiresAt;
}

export function quoteSecondsRemaining(quote: Quote): number {
  return Math.max(0, Math.ceil((quote.expiresAt - Date.now()) / 1000));
}
