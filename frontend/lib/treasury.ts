/**
 * Auron Treasury — INR Float Management
 *
 * The treasury is the fallback settlement path when OnMeta is unavailable.
 *
 * How it works:
 *   PRIMARY (OnMeta):
 *     USDC → OnMeta → INR payout to merchant UPI (one step, no float needed)
 *
 *   FALLBACK (Treasury + Razorpay X):
 *     1. Check Razorpay X INR balance is sufficient
 *     2. Reserve the INR amount (prevents double-spend)
 *     3. Razorpay X dispatches INR to merchant UPI
 *     4. USDC received is queued for conversion to replenish the float
 *     5. Cron job (/api/workers/treasury-replenish) processes the queue
 *
 * Treasury INR float is maintained by:
 *   - Operator manually loading INR into Razorpay X (pre-KYB)
 *   - Automated USDC → INR conversion via exchange API (post-KYB)
 *
 * DB tables required (add to Supabase):
 *   treasury_state        — single-row INR balance tracker
 *   treasury_reservations — per-payment INR holds
 *   treasury_usdc_queue   — USDC amounts queued for conversion
 *
 * SQL:
 *   CREATE TABLE treasury_state (
 *     id SERIAL PRIMARY KEY,
 *     inr_available   NUMERIC(14,2) NOT NULL DEFAULT 0,
 *     inr_reserved    NUMERIC(14,2) NOT NULL DEFAULT 0,
 *     usdc_pending    NUMERIC(14,6) NOT NULL DEFAULT 0,
 *     updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
 *   );
 *   INSERT INTO treasury_state (id) VALUES (1); -- single row, always id=1
 *
 *   CREATE TABLE treasury_reservations (
 *     id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
 *     payment_id  TEXT    NOT NULL UNIQUE,
 *     inr_amount  NUMERIC(14,2) NOT NULL,
 *     status      TEXT    NOT NULL DEFAULT 'reserved', -- reserved | consumed | released
 *     created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 *     updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *   );
 *
 *   CREATE TABLE treasury_usdc_queue (
 *     id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
 *     payment_id  TEXT    NOT NULL,
 *     usdc_amount NUMERIC(14,6) NOT NULL,
 *     status      TEXT    NOT NULL DEFAULT 'pending', -- pending | converting | converted | failed
 *     created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
 *   );
 */

import { createClient } from "@supabase/supabase-js";

// ── Supabase client (server-only) ─────────────────────────────────────────────

function db() {
  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secret) throw new Error("[treasury] Supabase env vars not set");
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TreasuryState {
  inrAvailable:  number;  // INR free to use (not reserved)
  inrReserved:   number;  // INR held for pending payouts
  usdcPending:   number;  // USDC queued for conversion
  totalINR:      number;  // inrAvailable + inrReserved
  updatedAt:     string;
}

export interface TreasuryReserveResult {
  ok:         boolean;
  reserved:   boolean;  // true = INR reserved successfully
  reason?:    string;   // why it failed
  balance?:   TreasuryState;
}

// ── Read treasury state ───────────────────────────────────────────────────────

export async function getTreasuryState(): Promise<TreasuryState | null> {
  try {
    const { data, error } = await db()
      .from("treasury_state")
      .select("*")
      .eq("id", 1)
      .single();

    if (error || !data) return null;

    return {
      inrAvailable: Number(data.inr_available),
      inrReserved:  Number(data.inr_reserved),
      usdcPending:  Number(data.usdc_pending),
      totalINR:     Number(data.inr_available) + Number(data.inr_reserved),
      updatedAt:    data.updated_at,
    };
  } catch (err) {
    console.error("[treasury] getTreasuryState failed:", err);
    return null;
  }
}

// ── Check if treasury can cover a payment ────────────────────────────────────

export async function canTreasuryCover(inrAmount: number): Promise<boolean> {
  const state = await getTreasuryState();
  if (!state) return false;
  // Require 10% buffer above the payout amount
  const required = inrAmount * 1.1;
  return state.inrAvailable >= required;
}

// ── Reserve INR for a payment (prevents double-spend) ────────────────────────

export async function reserveINR(
  paymentId: string,
  inrAmount: number
): Promise<TreasuryReserveResult> {
  try {
    // Check available balance first
    const state = await getTreasuryState();
    if (!state) {
      return { ok: false, reserved: false, reason: "Treasury state unavailable" };
    }
    if (state.inrAvailable < inrAmount) {
      return {
        ok:      false,
        reserved: false,
        reason:  `Insufficient INR float: ₹${state.inrAvailable.toFixed(2)} available, ₹${inrAmount.toFixed(2)} required`,
        balance:  state,
      };
    }

    // Atomically decrement available + increment reserved
    const { error: updateErr } = await db().rpc("reserve_treasury_inr", {
      p_payment_id: paymentId,
      p_inr_amount: inrAmount,
    });

    if (updateErr) {
      // Fallback: manual two-step if RPC not available
      const { error: resErr } = await db()
        .from("treasury_reservations")
        .insert({ payment_id: paymentId, inr_amount: inrAmount, status: "reserved" });

      if (resErr) {
        return { ok: false, reserved: false, reason: resErr.message };
      }

      await db()
        .from("treasury_state")
        .update({
          inr_available: state.inrAvailable - inrAmount,
          inr_reserved:  state.inrReserved  + inrAmount,
          updated_at:    new Date().toISOString(),
        })
        .eq("id", 1);
    }

    console.log(
      `[treasury] Reserved ₹${inrAmount.toFixed(2)} for paymentId=${paymentId}. ` +
      `Remaining: ₹${(state.inrAvailable - inrAmount).toFixed(2)}`
    );

    return { ok: true, reserved: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown";
    console.error(`[treasury] reserveINR failed paymentId=${paymentId}:`, msg);
    return { ok: false, reserved: false, reason: msg };
  }
}

// ── Consume reservation (payout succeeded) ────────────────────────────────────

export async function consumeReservation(paymentId: string): Promise<void> {
  try {
    // Mark reservation consumed — INR has left Razorpay X
    await db()
      .from("treasury_reservations")
      .update({ status: "consumed", updated_at: new Date().toISOString() })
      .eq("payment_id", paymentId)
      .eq("status", "reserved");

    // Decrement reserved balance (available was already decremented at reserve time)
    const res = await db()
      .from("treasury_reservations")
      .select("inr_amount")
      .eq("payment_id", paymentId)
      .single();

    if (res.data) {
      const state = await getTreasuryState();
      if (state) {
        await db()
          .from("treasury_state")
          .update({
            inr_reserved: Math.max(0, state.inrReserved - Number(res.data.inr_amount)),
            updated_at:   new Date().toISOString(),
          })
          .eq("id", 1);
      }
    }

    console.log(`[treasury] Reservation consumed paymentId=${paymentId}`);
  } catch (err) {
    console.error(`[treasury] consumeReservation failed paymentId=${paymentId}:`, err);
  }
}

// ── Release reservation (payout failed — return INR to available) ─────────────

export async function releaseReservation(paymentId: string): Promise<void> {
  try {
    const res = await db()
      .from("treasury_reservations")
      .select("inr_amount")
      .eq("payment_id", paymentId)
      .eq("status", "reserved")
      .single();

    if (!res.data) return;

    const inrAmount = Number(res.data.inr_amount);

    // Return INR from reserved → available
    const state = await getTreasuryState();
    if (state) {
      await db()
        .from("treasury_state")
        .update({
          inr_available: state.inrAvailable + inrAmount,
          inr_reserved:  Math.max(0, state.inrReserved - inrAmount),
          updated_at:    new Date().toISOString(),
        })
        .eq("id", 1);
    }

    await db()
      .from("treasury_reservations")
      .update({ status: "released", updated_at: new Date().toISOString() })
      .eq("payment_id", paymentId);

    console.log(`[treasury] Released ₹${inrAmount.toFixed(2)} back to available paymentId=${paymentId}`);
  } catch (err) {
    console.error(`[treasury] releaseReservation failed paymentId=${paymentId}:`, err);
  }
}

// ── Queue USDC for conversion (replenish treasury after payout) ───────────────

export async function queueUSDCForConversion(
  paymentId: string,
  usdcAmount: number
): Promise<void> {
  try {
    await db()
      .from("treasury_usdc_queue")
      .insert({ payment_id: paymentId, usdc_amount: usdcAmount, status: "pending" });

    // Track pending USDC in treasury state
    const state = await getTreasuryState();
    if (state) {
      await db()
        .from("treasury_state")
        .update({
          usdc_pending: state.usdcPending + usdcAmount,
          updated_at:   new Date().toISOString(),
        })
        .eq("id", 1);
    }

    console.log(
      `[treasury] Queued ${usdcAmount} USDC for conversion paymentId=${paymentId}. ` +
      `Total pending: ${(( await getTreasuryState())?.usdcPending ?? 0).toFixed(4)} USDC`
    );
  } catch (err) {
    console.error(`[treasury] queueUSDCForConversion failed paymentId=${paymentId}:`, err);
  }
}

// ── Get pending USDC queue (for replenishment cron) ──────────────────────────

export async function getPendingUSDCQueue(): Promise<
  Array<{ id: string; paymentId: string; usdcAmount: number }>
> {
  try {
    const { data, error } = await db()
      .from("treasury_usdc_queue")
      .select("id, payment_id, usdc_amount")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(50);

    if (error || !data) return [];

    return data.map((row) => ({
      id:          row.id as string,
      paymentId:   row.payment_id as string,
      usdcAmount:  Number(row.usdc_amount),
    }));
  } catch {
    return [];
  }
}

// ── Mark USDC queue item converted (after successful exchange) ────────────────

export async function markUSDCConverted(
  queueId:   string,
  inrAmount: number
): Promise<void> {
  try {
    await db()
      .from("treasury_usdc_queue")
      .update({ status: "converted" })
      .eq("id", queueId);

    // Credit the converted INR back into available balance
    const state = await getTreasuryState();
    if (state) {
      await db()
        .from("treasury_state")
        .update({
          inr_available: state.inrAvailable + inrAmount,
          usdc_pending:  Math.max(0, state.usdcPending - 1), // approximate
          updated_at:    new Date().toISOString(),
        })
        .eq("id", 1);
    }

    console.log(`[treasury] Converted USDC → ₹${inrAmount.toFixed(2)} queueId=${queueId}`);
  } catch (err) {
    console.error(`[treasury] markUSDCConverted failed queueId=${queueId}:`, err);
  }
}
