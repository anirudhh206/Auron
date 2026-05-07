/**
 * Auron Routing Engine
 *
 * Selects the best settlement provider for a given payment.
 * Scoring is based on: fee %, settlement speed, region support, amount limits.
 *
 * To add a new provider:
 *   1. Add it to SettlementProvider
 *   2. Add its capability row to PROVIDER_MATRIX
 *   3. No other changes needed — scoring is automatic
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type SettlementProvider = "onmeta" | "transak" | "stripe" | "manual";
export type PaymentRegion      = "IN" | "US" | "EU" | "SEA" | "LATAM" | "unknown";
export type PaymentMethod      = "upi" | "imps" | "neft" | "ach" | "sepa" | "pix" | "card";

export interface RouteResult {
  provider:             SettlementProvider;
  feePercent:           number;
  estimatedTimeSeconds: number;
  estimatedTimeLabel:   string;
  method:               PaymentMethod;
  region:               PaymentRegion;
  reason:               string;
  fallback:             SettlementProvider;
}

// ── Provider capability matrix ────────────────────────────────────────────────
// Each row = one provider. Add new providers here without touching any logic.

interface ProviderCaps {
  regions:       PaymentRegion[];
  methods:       PaymentMethod[];
  feePercent:    number;
  avgTimeSeconds: number;
  maxAmountUSD:  number;
  minAmountUSD:  number;
  live:          boolean;   // false = SDK/API integration pending
}

const PROVIDER_MATRIX: Record<SettlementProvider, ProviderCaps> = {
  onmeta: {
    regions:        ["IN"],
    methods:        ["upi", "imps", "neft"],
    feePercent:     0.5,
    avgTimeSeconds: 20,
    maxAmountUSD:   5_000,
    minAmountUSD:   0.5,
    live:           true,
  },
  transak: {
    regions:        ["IN", "US", "EU", "SEA"],
    methods:        ["upi", "card", "ach", "sepa"],
    feePercent:     1.5,
    avgTimeSeconds: 60,
    maxAmountUSD:   10_000,
    minAmountUSD:   1,
    live:           false,   // pending KYB — will activate automatically
  },
  stripe: {
    regions:        ["US", "EU"],
    methods:        ["ach", "sepa", "card"],
    feePercent:     2.9,
    avgTimeSeconds: 86_400,  // next-day ACH
    maxAmountUSD:   50_000,
    minAmountUSD:   5,
    live:           false,
  },
  manual: {
    regions:        ["IN", "US", "EU", "SEA", "LATAM", "unknown"],
    methods:        ["upi", "ach", "sepa", "card"],
    feePercent:     0,
    avgTimeSeconds: 3_600,
    maxAmountUSD:   999_999,
    minAmountUSD:   0,
    live:           true,    // always available as last resort
  },
};

// ── Region detection ──────────────────────────────────────────────────────────

export function detectRegion(currency: string, recipientId?: string): PaymentRegion {
  if (currency === "INR")  return "IN";
  if (currency === "USD")  return "US";
  if (currency === "EUR")  return "EU";
  if (currency === "BRL")  return "LATAM";
  // UPI IDs always = India
  if (recipientId?.includes("@")) return "IN";
  return "unknown";
}

// ── Routing engine ────────────────────────────────────────────────────────────

export function chooseProvider(
  region:       PaymentRegion,
  amountUSD:    number,
  options: {
    preferredMethod?: PaymentMethod;
    forceProvider?:   SettlementProvider;
    excludeLive?:     boolean;  // include non-live providers (for future routing)
  } = {}
): RouteResult {

  // Force override (admin / feature flag)
  if (options.forceProvider) {
    return buildResult(options.forceProvider, region, "manual");
  }

  // Score all eligible providers
  const candidates: Array<{ provider: SettlementProvider; score: number }> = [];

  for (const [name, caps] of Object.entries(PROVIDER_MATRIX) as [SettlementProvider, ProviderCaps][]) {
    if (name === "manual") continue;                                    // manual = last resort only
    if (!caps.live && !options.excludeLive) continue;                  // skip non-live providers
    if (!caps.regions.includes(region) && region !== "unknown") continue;
    if (amountUSD > caps.maxAmountUSD) continue;
    if (amountUSD < caps.minAmountUSD) continue;

    // Score: weight fee 60%, speed 40%
    const feeScore   = (1 / (caps.feePercent  || 0.001)) * 60;
    const speedScore = (1 / (caps.avgTimeSeconds || 1))  * 40_000;
    candidates.push({ provider: name, score: feeScore + speedScore });
  }

  if (candidates.length === 0) {
    // Nothing eligible → manual fallback
    return buildResult("manual", region, "manual");
  }

  // Sort descending — highest score wins
  candidates.sort((a, b) => b.score - a.score);
  const best     = candidates[0].provider;
  const fallback = candidates[1]?.provider ?? "manual";

  return buildResult(best, region, fallback);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildResult(
  provider: SettlementProvider,
  region:   PaymentRegion,
  fallback: SettlementProvider,
): RouteResult {
  const caps   = PROVIDER_MATRIX[provider];
  const method = caps.methods[0] as PaymentMethod;

  return {
    provider,
    feePercent:           caps.feePercent,
    estimatedTimeSeconds: caps.avgTimeSeconds,
    estimatedTimeLabel:   formatDuration(caps.avgTimeSeconds),
    method,
    region,
    reason: provider === "manual"
      ? "No automated provider available — queued for manual settlement"
      : `Best route: ${provider} · ${caps.feePercent}% fee · ~${formatDuration(caps.avgTimeSeconds)}`,
    fallback,
  };
}

function formatDuration(seconds: number): string {
  if (seconds < 60)     return `${seconds}s`;
  if (seconds < 3_600)  return `${Math.round(seconds / 60)}min`;
  if (seconds < 86_400) return `${Math.round(seconds / 3_600)}h`;
  return `${Math.round(seconds / 86_400)}d`;
}
