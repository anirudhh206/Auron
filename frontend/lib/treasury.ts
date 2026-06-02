/**
 * Auron Treasury — Protocol Revenue Tracker
 *
 * The treasury fills itself automatically.
 *
 * Every OnMeta payment:
 *   User pays X USDC (at Auron rate = market - 0.85% spread)
 *   OnMeta converts Y USDC → exact INR → merchant UPI
 *   X - Y USDC = spread stays in treasury wallet on Solana
 *
 * No manual funding. No pre-loaded fiat. No bank accounts.
 * The fee wallet balance IS the treasury.
 *
 * Example:
 *   User pays 5.402 USDC for ₹450
 *   OnMeta uses 5.35 USDC → ₹450 to merchant
 *   0.052 USDC (0.85%) stays in treasury
 *   After 1,000 payments: ~52 USDC in treasury
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddress } from "@solana/spl-token";

// USDC mint addresses
const USDC_MINT = {
  "mainnet-beta": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "devnet":       "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
};

export const SPREAD_PERCENT = 0.85;

export interface TreasuryState {
  usdcBalance:     number;   // USDC accumulated in fee wallet
  walletAddress:   string;   // Treasury wallet (NEXT_PUBLIC_FEE_WALLET)
  network:         "mainnet-beta" | "devnet";
  spreadPercent:   number;   // 0.85 — kept per payment
  estimatedUSD:    number;   // USDC balance ≈ USD (1:1 peg)
  source:          "solana_rpc" | "unavailable";
}

export async function getTreasuryState(): Promise<TreasuryState> {
  const walletAddress = process.env.NEXT_PUBLIC_FEE_WALLET ?? "";
  const rpcUrl        = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const network       = (process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet") as "mainnet-beta" | "devnet";
  const usdcMint      = USDC_MINT[network] ?? USDC_MINT.devnet;

  const unavailable: TreasuryState = {
    usdcBalance:   0,
    walletAddress,
    network,
    spreadPercent: SPREAD_PERCENT,
    estimatedUSD:  0,
    source:        "unavailable",
  };

  if (!walletAddress) {
    console.warn("[treasury] NEXT_PUBLIC_FEE_WALLET not set");
    return unavailable;
  }

  try {
    const connection   = new Connection(rpcUrl, "confirmed");
    const wallet       = new PublicKey(walletAddress);
    const mint         = new PublicKey(usdcMint);
    const tokenAccount = await getAssociatedTokenAddress(mint, wallet);
    const accountInfo  = await getAccount(connection, tokenAccount);

    // USDC has 6 decimal places
    const usdcBalance = Number(accountInfo.amount) / 1_000_000;

    console.log(`[treasury] Balance: ${usdcBalance.toFixed(6)} USDC wallet=${walletAddress} network=${network}`);

    return {
      usdcBalance,
      walletAddress,
      network,
      spreadPercent: SPREAD_PERCENT,
      estimatedUSD:  usdcBalance, // USDC ≈ USD
      source:        "solana_rpc",
    };
  } catch {
    // Token account may not exist yet — no payments processed yet
    return { ...unavailable, usdcBalance: 0, source: "unavailable" };
  }
}

/**
 * Calculate how much protocol revenue a payment generates.
 * Used to show the user what Auron keeps from each transaction.
 */
export function calculateSpread(usdcAmount: number): {
  spreadUSDC:    number;
  netUSDC:       number;   // what goes to OnMeta
  spreadPercent: number;
} {
  const spreadUSDC = parseFloat((usdcAmount * SPREAD_PERCENT / 100).toFixed(6));
  const netUSDC    = parseFloat((usdcAmount - spreadUSDC).toFixed(6));
  return { spreadUSDC, netUSDC, spreadPercent: SPREAD_PERCENT };
}
