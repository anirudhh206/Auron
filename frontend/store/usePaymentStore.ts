/**
 * Auron Payment Store
 *
 * Persists every payment record across sessions.
 * Acts as the client-side ledger — source of truth for UI state.
 * Backed by localStorage (persisted) + memory.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  PaymentRecord,
  PaymentStatus,
  PaymentEvent,
  LiquiditySnapshot,
  MINIMUM_TREASURY_RESERVE_USDC,
  transitionPayment,
} from "@/lib/payment-state";

interface PaymentStore {
  // ── Records ──────────────────────────────────────────────────────────────────
  payments: PaymentRecord[];

  // ── Active payment (the one currently being processed) ───────────────────────
  activePaymentId: string | null;

  // ── Liquidity ─────────────────────────────────────────────────────────────────
  liquidity: LiquiditySnapshot | null;

  // ── CRUD ──────────────────────────────────────────────────────────────────────
  addPayment: (record: PaymentRecord) => void;
  updatePayment: (paymentId: string, updater: (r: PaymentRecord) => PaymentRecord) => void;
  setActivePayment: (paymentId: string | null) => void;

  // ── Transitions ───────────────────────────────────────────────────────────────
  transition: (
    paymentId: string,
    newStatus: PaymentStatus,
    message: string,
    data?: Record<string, unknown>
  ) => void;

  appendEvent: (paymentId: string, event: PaymentEvent) => void;

  // ── Queries ───────────────────────────────────────────────────────────────────
  getPayment: (paymentId: string) => PaymentRecord | null;
  getActivePayment: () => PaymentRecord | null;
  getPendingPayments: () => PaymentRecord[];
  getCompletedPayments: () => PaymentRecord[];

  // ── Liquidity ─────────────────────────────────────────────────────────────────
  setLiquidity: (snapshot: LiquiditySnapshot) => void;

  // ── Derived ───────────────────────────────────────────────────────────────────
  totalVolume: () => number;        // total INR paid out (completed)
  inFlightUsdc: () => number;       // USDC locked in pending payments

  // ── Housekeeping ──────────────────────────────────────────────────────────────
  clearOldRecords: (olderThanMs?: number) => void; // prune >30 day old records
}

export const usePaymentStore = create<PaymentStore>()(
  persist(
    (set, get) => ({
      payments: [],
      activePaymentId: null,
      liquidity: null,

      // ── CRUD ────────────────────────────────────────────────────────────────
      addPayment: (record) =>
        set((s) => ({ payments: [record, ...s.payments] })),

      updatePayment: (paymentId, updater) =>
        set((s) => ({
          payments: s.payments.map((p) =>
            p.paymentId === paymentId ? updater(p) : p
          ),
        })),

      setActivePayment: (paymentId) =>
        set({ activePaymentId: paymentId }),

      // ── Transitions ─────────────────────────────────────────────────────────
      transition: (paymentId, newStatus, message, data) =>
        set((s) => ({
          payments: s.payments.map((p) =>
            p.paymentId === paymentId
              ? transitionPayment(p, newStatus, message, data)
              : p
          ),
        })),

      appendEvent: (paymentId, event) =>
        set((s) => ({
          payments: s.payments.map((p) =>
            p.paymentId === paymentId
              ? { ...p, events: [...p.events, event] }
              : p
          ),
        })),

      // ── Queries ─────────────────────────────────────────────────────────────
      getPayment: (paymentId) =>
        get().payments.find((p) => p.paymentId === paymentId) ?? null,

      getActivePayment: () => {
        const id = get().activePaymentId;
        if (!id) return null;
        return get().payments.find((p) => p.paymentId === id) ?? null;
      },

      getPendingPayments: () =>
        get().payments.filter(
          (p) =>
            !["completed", "failed", "refunded"].includes(p.status)
        ),

      getCompletedPayments: () =>
        get().payments.filter((p) => p.status === "completed"),

      // ── Liquidity ────────────────────────────────────────────────────────────
      setLiquidity: (snapshot) => set({ liquidity: snapshot }),

      // ── Derived ─────────────────────────────────────────────────────────────
      totalVolume: () =>
        get()
          .payments.filter((p) => p.status === "completed")
          .reduce((sum, p) => sum + p.inrAmount, 0),

      inFlightUsdc: () =>
        get()
          .payments.filter(
            (p) =>
              !["idle", "completed", "failed", "refunded"].includes(p.status)
          )
          .reduce((sum, p) => sum + p.usdcAmount, 0),

      // ── Housekeeping ─────────────────────────────────────────────────────────
      clearOldRecords: (olderThanMs = 30 * 24 * 60 * 60 * 1000) => {
        const cutoff = Date.now() - olderThanMs;
        set((s) => ({
          payments: s.payments.filter((p) => p.initiatedAt >= cutoff),
        }));
      },
    }),
    {
      name: "auron-payments",
      version: 1,
      // Don't persist the active payment ID — cleared on reload
      partialize: (s) => ({
        payments: s.payments,
        liquidity: s.liquidity,
      }),
    }
  )
);

// ─── Liquidity health helper ──────────────────────────────────────────────────
export function computeLiquiditySnapshot(
  treasuryBalance: number,
  inFlightUsdc: number
): LiquiditySnapshot {
  const available = treasuryBalance - inFlightUsdc;
  return {
    treasuryBalance,
    inFlightUsdc,
    availableUsdc: available,
    minimumReserve: MINIMUM_TREASURY_RESERVE_USDC,
    isHealthy: available >= MINIMUM_TREASURY_RESERVE_USDC,
    lastCheckedAt: Date.now(),
  };
}
