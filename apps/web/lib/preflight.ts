/**
 * Pre-flight checks before executing any payment.
 * Run these BEFORE building or signing a transaction.
 *
 * Checks:
 *  1. USDC balance — user has enough to cover the payment
 *  2. Network mismatch — Phantom is on the correct Solana network
 *  3. SOL balance — enough for transaction fees (~0.000005 SOL)
 */

import { getUSDCBalance, getSOLBalance, NETWORK } from "@/lib/solana";

export type PreflightStatus = "ok" | "insufficient_usdc" | "insufficient_sol" | "network_mismatch";

export interface PreflightResult {
  status: PreflightStatus;
  ok: boolean;
  // Human-readable message shown directly in the UI
  message: string;
  // Current balances (always populated even on failure)
  usdcBalance: number;
  solBalance: number;
}

const MIN_SOL_FOR_FEE = 0.001; // ~0.000005 needed but keep a safe margin

/**
 * Run all pre-flight checks before a UPI payment.
 *
 * @param walletAddress  User's Phantom public key (base58)
 * @param requiredUsdc   USDC amount the payment will deduct
 * @param walletNetwork  Network Phantom reports ("devnet" | "mainnet-beta")
 */
export async function runPreflightChecks(
  walletAddress: string,
  requiredUsdc: number,
  walletNetwork: string
): Promise<PreflightResult> {
  // ── 1. Network mismatch ──────────────────────────────────────────────────
  if (walletNetwork && walletNetwork !== NETWORK) {
    return {
      status: "network_mismatch",
      ok: false,
      message: `Your wallet is on ${walletNetwork} but Auron is on ${NETWORK}. Switch networks in Phantom.`,
      usdcBalance: 0,
      solBalance: 0,
    };
  }

  // ── 2. Fetch balances in parallel ────────────────────────────────────────
  const [usdcBalance, solBalance] = await Promise.all([
    getUSDCBalance(walletAddress),
    getSOLBalance(walletAddress),
  ]);

  // ── 3. USDC balance check ────────────────────────────────────────────────
  if (usdcBalance < requiredUsdc) {
    const short = requiredUsdc.toFixed(4);
    const have  = usdcBalance.toFixed(4);
    return {
      status: "insufficient_usdc",
      ok: false,
      message: `Insufficient USDC. Need ${short} USDC but you have ${have} USDC.`,
      usdcBalance,
      solBalance,
    };
  }

  // ── 4. SOL fee check ─────────────────────────────────────────────────────
  if (solBalance < MIN_SOL_FOR_FEE) {
    return {
      status: "insufficient_sol",
      ok: false,
      message: `Insufficient SOL for transaction fees. You need at least ${MIN_SOL_FOR_FEE} SOL.`,
      usdcBalance,
      solBalance,
    };
  }

  return {
    status: "ok",
    ok: true,
    message: "All checks passed.",
    usdcBalance,
    solBalance,
  };
}
