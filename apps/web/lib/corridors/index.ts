/**
 * Corridor Registry
 *
 * All payment corridors registered here. The settlement orchestrator
 * uses `detectCorridor()` to auto-select based on recipient format,
 * or `getCorridor()` for an explicit corridor ID.
 */

import type { PaymentCorridor } from "./base";
import { upiCorridor }       from "./upi";
import { promptPayCorridor } from "./promptpay";
import { pixCorridor }       from "./pix";

export type { PaymentCorridor, CorridorMeta, QuoteRequest, QuoteResult, SettleRequest, SettleResult, RefundRequest, RefundResult } from "./base";

const REGISTRY: PaymentCorridor[] = [
  upiCorridor,
  promptPayCorridor,
  pixCorridor,
];

/** Get a corridor by its ID. Throws if not found. */
export function getCorridor(id: string): PaymentCorridor {
  const corridor = REGISTRY.find((c) => c.meta.id === id);
  if (!corridor) throw new Error(`Unknown corridor: ${id}`);
  return corridor;
}

/**
 * Auto-detect the correct corridor from a recipient identifier.
 * Checks live corridors first, then pending ones.
 * Returns null if no corridor recognizes the recipient format.
 */
export function detectCorridor(recipientId: string): PaymentCorridor | null {
  // Prefer live corridors
  const live = REGISTRY.filter((c) => c.meta.status === "live");
  for (const corridor of live) {
    if (corridor.accepts(recipientId)) return corridor;
  }

  // Fall through to pending corridors (useful for error messages)
  for (const corridor of REGISTRY) {
    if (corridor.accepts(recipientId)) return corridor;
  }

  return null;
}

/** List all registered corridors (for API responses / docs). */
export function listCorridors() {
  return REGISTRY.map((c) => c.meta);
}
