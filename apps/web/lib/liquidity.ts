/**
 * Auron — Liquidity Model
 *
 * Tracks real-time treasury health and enforces pre-payment liquidity gates.
 *
 * Two types of liquidity matter:
 *
 *   1. USDC in treasury wallet (on-chain) — what Auron actually holds
 *   2. In-flight USDC — funds locked in pending/settling payments
 *
 * Available = treasury_balance - in_flight
 *
 * The liquidity gate runs BEFORE a new payment is initiated:
 *   - Reject if treasury is below minimum reserve
 *   - Reject if adding this payment would breach the in-flight cap
 *
 * For PATH B (Treasury + Razorpay): also tracks INR float separately.
 */

import { getTreasuryState }          from "./treasury";
import { createClient }              from "@supabase/supabase-js";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Minimum USDC that must always remain in treasury (not sent to providers) */
export const MIN_RESERVE_USDC = 50;

/** Maximum USDC that can be in-flight at any time */
export const MAX_IN_FLIGHT_USDC = 10_000;

/** Single payment hard cap in USDC */
export const MAX_PAYMENT_USDC = 5_000;

/** Minimum payment amount in USDC */
export const MIN_PAYMENT_USDC = 0.5;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LiquidityState {
  treasuryUsdc:   number;    // on-chain USDC balance
  inFlightUsdc:   number;    // locked in pending/settling txns
  availableUsdc:  number;    // treasuryUsdc - inFlightUsdc
  reserveUsdc:    number;    // MIN_RESERVE_USDC
  isHealthy:      boolean;   // availableUsdc >= reserveUsdc
  utilizationPct: number;    // inFlightUsdc / MAX_IN_FLIGHT_USDC * 100
  lastCheckedAt:  number;    // Unix ms
  source:         "live" | "cached" | "unavailable";
}

export interface LiquidityGateResult {
  allowed:   boolean;
  reason?:   string;
  state:     LiquidityState;
}

// ── Supabase client (lazy) ────────────────────────────────────────────────────

function db() {
  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw new Error("[liquidity] Supabase env vars not set");
  return createClient(url, secret, { auth: { persistSession: false } });
}

// ── In-flight USDC ────────────────────────────────────────────────────────────
/**
 * Sum USDC locked in active (non-terminal) transactions.
 * "In-flight" = initiated | quoted | signed | verified | settling
 */
export async function getInFlightUsdc(): Promise<number> {
  try {
    const { data } = await db()
      .from("transactions")
      .select("usdc_amount")
      .in("status", ["initiated", "quoted", "signed", "verified", "settling"]);

    if (!data) return 0;
    return data.reduce((sum: number, r: { usdc_amount: number }) => sum + Number(r.usdc_amount), 0);
  } catch (err) {
    console.error("[liquidity] getInFlightUsdc error:", err);
    return 0; // Fail-open: don't block payments on a DB read error
  }
}

// ── Full liquidity state ──────────────────────────────────────────────────────

export async function getLiquidityState(): Promise<LiquidityState> {
  try {
    const [treasury, inFlight] = await Promise.all([
      getTreasuryState(),
      getInFlightUsdc(),
    ]);

    const treasuryUsdc  = treasury.usdcBalance;
    const available     = Math.max(0, treasuryUsdc - inFlight);
    const isHealthy     = available >= MIN_RESERVE_USDC;
    const utilizationPct = MAX_IN_FLIGHT_USDC > 0
      ? Math.round((inFlight / MAX_IN_FLIGHT_USDC) * 100)
      : 0;

    const state: LiquidityState = {
      treasuryUsdc,
      inFlightUsdc:   inFlight,
      availableUsdc:  available,
      reserveUsdc:    MIN_RESERVE_USDC,
      isHealthy,
      utilizationPct,
      lastCheckedAt:  Date.now(),
      source:         treasury.source === "solana_rpc" ? "live" : "unavailable",
    };

    if (!isHealthy) {
      console.warn(
        `[liquidity] UNHEALTHY treasury=${treasuryUsdc} inFlight=${inFlight} ` +
        `available=${available} reserve=${MIN_RESERVE_USDC}`
      );
    }

    return state;
  } catch (err) {
    console.error("[liquidity] getLiquidityState error:", err);
    // Return a safe fallback — treat as unavailable but don't block
    return {
      treasuryUsdc:   0,
      inFlightUsdc:   0,
      availableUsdc:  0,
      reserveUsdc:    MIN_RESERVE_USDC,
      isHealthy:      false,
      utilizationPct: 0,
      lastCheckedAt:  Date.now(),
      source:         "unavailable",
    };
  }
}

// ── Pre-payment liquidity gate ────────────────────────────────────────────────
/**
 * Call this BEFORE creating a new payment record.
 * Returns { allowed: true } if the payment can proceed.
 */
export async function checkLiquidityGate(
  amountUsdc: number,
): Promise<LiquidityGateResult> {
  // Hard limits — no DB call needed
  if (amountUsdc < MIN_PAYMENT_USDC) {
    const state = await getLiquidityState();
    return {
      allowed: false,
      reason:  `Minimum payment is ${MIN_PAYMENT_USDC} USDC (requested ${amountUsdc.toFixed(6)})`,
      state,
    };
  }

  if (amountUsdc > MAX_PAYMENT_USDC) {
    const state = await getLiquidityState();
    return {
      allowed: false,
      reason:  `Maximum payment is ${MAX_PAYMENT_USDC} USDC (requested ${amountUsdc.toFixed(6)})`,
      state,
    };
  }

  const state = await getLiquidityState();

  // If we can't read the treasury (RPC down), fail-open in demo mode,
  // fail-closed in production to prevent uncovered payments.
  const demoMode = process.env.DEMO_SETTLEMENT === "true";
  if (state.source === "unavailable" && !demoMode) {
    return {
      allowed: false,
      reason:  "Treasury balance unavailable — cannot verify liquidity",
      state,
    };
  }
  if (state.source === "unavailable" && demoMode) {
    // Demo: pass through
    return { allowed: true, state };
  }

  // Reserve check: treasury must hold at least MIN_RESERVE + this payment
  const requiredBalance = MIN_RESERVE_USDC + amountUsdc;
  if (state.treasuryUsdc < requiredBalance) {
    return {
      allowed: false,
      reason:  `Treasury insufficient: ${state.treasuryUsdc.toFixed(2)} USDC available, ` +
               `${requiredBalance.toFixed(2)} USDC required (reserve + payment)`,
      state,
    };
  }

  // In-flight cap check
  const projectedInFlight = state.inFlightUsdc + amountUsdc;
  if (projectedInFlight > MAX_IN_FLIGHT_USDC) {
    return {
      allowed: false,
      reason:  `In-flight cap would be breached: ${projectedInFlight.toFixed(2)} / ${MAX_IN_FLIGHT_USDC} USDC`,
      state,
    };
  }

  return { allowed: true, state };
}

// ── Reserve alert ─────────────────────────────────────────────────────────────
/**
 * Returns true if the treasury is below warning threshold.
 * Call from monitoring/alerting endpoints.
 */
export function isReserveWarning(state: LiquidityState): boolean {
  return state.availableUsdc < MIN_RESERVE_USDC * 2; // warn at 2x reserve
}

export function isReserveCritical(state: LiquidityState): boolean {
  return state.availableUsdc < MIN_RESERVE_USDC;
}

// ── Human-readable summary ────────────────────────────────────────────────────

export function formatLiquidityState(state: LiquidityState): string {
  const status = state.isHealthy ? "HEALTHY" : "UNHEALTHY";
  return (
    `[liquidity:${status}] ` +
    `treasury=${state.treasuryUsdc.toFixed(2)} ` +
    `inFlight=${state.inFlightUsdc.toFixed(2)} ` +
    `available=${state.availableUsdc.toFixed(2)} ` +
    `utilization=${state.utilizationPct}%`
  );
}
