/**
 * Auron Routing Engine
 *
 * Selects the best settlement path for a given payment.
 *
 * TWO DISTINCT PATHS — not interchangeable:
 *
 *   PATH A — OnMeta (primary):
 *     USDC → OnMeta API → INR → merchant UPI
 *     OnMeta handles the full USDC→INR conversion + UPI payout in one step.
 *     No INR float required. Requires OnMeta KYB.
 *
 *   PATH B — Treasury + Razorpay X (fallback):
 *     USDC received → Auron INR treasury (pre-funded float) → Razorpay X → merchant UPI
 *     Razorpay X sends INR from Auron's float. USDC is queued for conversion to replenish.
 *     Requires: RAZORPAY_ACCOUNT_ID + funded Razorpay X balance.
 *     Razorpay does NOT convert USDC — it only dispatches INR payouts.
 *
 *   PATH C — Manual (last resort):
 *     Payment queued for manual operator processing.
 */

export type SettlementPath   = "onmeta" | "treasury_razorpay" | "manual";
export type PaymentRegion    = "IN" | "US" | "EU" | "SEA" | "LATAM" | "unknown";
export type PaymentMethod    = "upi" | "imps" | "neft" | "ach" | "sepa" | "pix" | "card";

export interface RouteResult {
  path:                 SettlementPath;
  feePercent:           number;
  estimatedTimeSeconds: number;
  estimatedTimeLabel:   string;
  method:               PaymentMethod;
  region:               PaymentRegion;
  reason:               string;
  fallback:             SettlementPath;
  requiresINRFloat:     boolean;  // true = PATH B — needs treasury balance
}

// ── Path definitions ──────────────────────────────────────────────────────────

interface PathConfig {
  description:     string;
  regions:         PaymentRegion[];
  methods:         PaymentMethod[];
  feePercent:      number;
  avgTimeSeconds:  number;
  maxAmountUSD:    number;
  minAmountUSD:    number;
  live:            boolean;
  requiresINRFloat: boolean;  // PATH B requires pre-funded INR treasury
  requiresKYB:     boolean;
}

const PATHS: Record<SettlementPath, PathConfig> = {
  onmeta: {
    description:      "OnMeta — full USDC→INR offramp + UPI payout in one step",
    regions:          ["IN"],
    methods:          ["upi", "imps", "neft"],
    feePercent:       0.5,
    avgTimeSeconds:   20,
    maxAmountUSD:     5_000,
    minAmountUSD:     0.5,
    live:             true,
    requiresINRFloat: false,  // OnMeta handles USDC directly
    requiresKYB:      true,   // Requires OnMeta KYB
  },

  treasury_razorpay: {
    description:      "Treasury + Razorpay X — INR float payout (Razorpay does NOT convert USDC)",
    regions:          ["IN"],
    methods:          ["upi"],
    feePercent:       0.99,   // Razorpay X: 0.99% + GST on UPI payouts
    avgTimeSeconds:   15,
    maxAmountUSD:     10_000,
    minAmountUSD:     0.5,
    live:             true,   // Razorpay X API is integrated
    requiresINRFloat: true,   // MUST have funded INR treasury
    requiresKYB:      true,   // Requires Razorpay X KYB + RAZORPAY_ACCOUNT_ID
  },

  manual: {
    description:      "Manual operator processing — last resort",
    regions:          ["IN", "US", "EU", "SEA", "LATAM", "unknown"],
    methods:          ["upi", "ach", "sepa", "card"],
    feePercent:       0,
    avgTimeSeconds:   3_600,
    maxAmountUSD:     999_999,
    minAmountUSD:     0,
    live:             true,
    requiresINRFloat: false,
    requiresKYB:      false,
  },
};

// ── Region detection ──────────────────────────────────────────────────────────

export function detectRegion(currency: string, recipientId?: string): PaymentRegion {
  if (currency === "INR") return "IN";
  if (currency === "USD") return "US";
  if (currency === "EUR") return "EU";
  if (currency === "BRL") return "LATAM";
  if (recipientId?.includes("@")) return "IN"; // UPI ID = India
  return "unknown";
}

// ── Routing engine ────────────────────────────────────────────────────────────

export interface ChoosePathOptions {
  forceProvider?:      SettlementPath;
  inrTreasuryBalance?: number;   // Pass current treasury INR balance — enables PATH B
  amountINR?:          number;   // Required to check treasury sufficiency
}

export function chooseProvider(
  region:    PaymentRegion,
  amountUSD: number,
  options:   ChoosePathOptions = {}
): RouteResult {

  // Force override (admin / feature flag)
  if (options.forceProvider) {
    return buildResult(options.forceProvider, region, "manual");
  }

  // ── PATH A — OnMeta (primary, always first choice for India) ──────────────
  const onmeta = PATHS.onmeta;
  const onmetaEligible =
    onmeta.live &&
    onmeta.regions.includes(region) &&
    amountUSD >= onmeta.minAmountUSD &&
    amountUSD <= onmeta.maxAmountUSD;

  if (onmetaEligible) {
    // Check if PATH B is also viable (to set correct fallback)
    const pathBViable = isTreasuryPathViable(region, amountUSD, options);
    const fallback: SettlementPath = pathBViable ? "treasury_razorpay" : "manual";
    return buildResult("onmeta", region, fallback);
  }

  // ── PATH B — Treasury + Razorpay X (fallback when OnMeta unavailable) ─────
  // Only selected when:
  //   1. OnMeta not eligible (wrong region / amount / KYB pending)
  //   2. Treasury has sufficient INR balance
  //   3. RAZORPAY_ACCOUNT_ID is configured
  if (isTreasuryPathViable(region, amountUSD, options)) {
    return buildResult("treasury_razorpay", region, "manual");
  }

  // ── PATH C — Manual (last resort) ─────────────────────────────────────────
  return buildResult("manual", region, "manual");
}

// ── Check if treasury path is viable ─────────────────────────────────────────

function isTreasuryPathViable(
  region:    PaymentRegion,
  amountUSD: number,
  options:   ChoosePathOptions
): boolean {
  const cfg = PATHS.treasury_razorpay;

  // Must have Razorpay X account configured
  if (!process.env.RAZORPAY_ACCOUNT_ID) return false;

  // Region + amount limits
  if (!cfg.regions.includes(region))    return false;
  if (amountUSD < cfg.minAmountUSD)     return false;
  if (amountUSD > cfg.maxAmountUSD)     return false;

  // Must have sufficient INR float (with 10% safety buffer)
  if (options.inrTreasuryBalance !== undefined && options.amountINR !== undefined) {
    const required = options.amountINR * 1.1;
    if (options.inrTreasuryBalance < required) return false;
  }

  return true;
}

// ── Build RouteResult ─────────────────────────────────────────────────────────

function buildResult(
  path:     SettlementPath,
  region:   PaymentRegion,
  fallback: SettlementPath,
): RouteResult {
  const cfg    = PATHS[path];
  const method = cfg.methods[0] as PaymentMethod;

  const reason = path === "manual"
    ? "No automated path available — queued for manual settlement"
    : path === "treasury_razorpay"
    ? `Treasury path: Razorpay X INR float → ${cfg.feePercent}% fee · ~${formatDuration(cfg.avgTimeSeconds)} · USDC queued for conversion`
    : `OnMeta: full USDC→INR offramp · ${cfg.feePercent}% fee · ~${formatDuration(cfg.avgTimeSeconds)}`;

  return {
    path,
    // Keep `provider` as alias so existing callers don't break
    ...({ provider: path } as any),
    feePercent:           cfg.feePercent,
    estimatedTimeSeconds: cfg.avgTimeSeconds,
    estimatedTimeLabel:   formatDuration(cfg.avgTimeSeconds),
    method,
    region,
    reason,
    fallback,
    requiresINRFloat:     cfg.requiresINRFloat,
  };
}

function formatDuration(seconds: number): string {
  if (seconds < 60)     return `${seconds}s`;
  if (seconds < 3_600)  return `${Math.round(seconds / 60)}min`;
  if (seconds < 86_400) return `${Math.round(seconds / 3_600)}h`;
  return `${Math.round(seconds / 86_400)}d`;
}
