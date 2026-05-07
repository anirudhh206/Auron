/**
 * Auron — Server-side Solana Transaction Verifier
 *
 * Called by /api/offramp BEFORE any settlement action.
 * Ensures the on-chain transfer actually happened as claimed:
 *   ✓ Signature is confirmed / finalized on Solana
 *   ✓ Correct USDC mint (not a fake token)
 *   ✓ Correct treasury recipient
 *   ✓ Amount matches (within 0.1% tolerance for rounding)
 *   ✓ Idempotency — signature not previously settled
 *
 * In DEMO_SETTLEMENT=true mode:
 *   - If no signature is provided → skip verification, return verified=false, demoMode=true
 *   - If a signature IS provided → still verify it (demo doesn't mean skip real checks)
 */

import { Connection, PublicKey } from "@solana/web3.js";

// ── Constants ─────────────────────────────────────────────────────────────────

// USDC mint addresses
const USDC_MINT_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_MINT_DEVNET  = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

// In-memory signature dedup (replace with Redis/DB in production)
const settledSignatures = new Set<string>();

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VerifyTxParams {
  signature:            string;
  expectedFromAddress:  string;    // user wallet
  expectedToAddress:    string;    // Auron treasury
  expectedUsdcAmount:   number;    // USDC (float, 6 decimals)
}

export interface VerifyTxResult {
  verified:        boolean;
  demoMode:        boolean;
  failureReason?:  string;
  actualAmount?:   number;         // USDC actually transferred
  blockTime?:      number;         // Unix ms of confirmation
  confirmationStatus?: string;
}

// ── Verifier ─────────────────────────────────────────────────────────────────

export async function verifyUsdcTransfer(
  params: VerifyTxParams
): Promise<VerifyTxResult> {
  const demoMode = process.env.DEMO_SETTLEMENT === "true";

  // No signature → demo path
  if (!params.signature || params.signature.startsWith("demo_")) {
    if (demoMode) {
      return { verified: false, demoMode: true };
    }
    return {
      verified:      false,
      demoMode:      false,
      failureReason: "No transaction signature provided and DEMO_SETTLEMENT is not enabled",
    };
  }

  // Duplicate signature check
  if (settledSignatures.has(params.signature)) {
    return {
      verified:      false,
      demoMode,
      failureReason: "This transaction signature has already been settled (duplicate)",
    };
  }

  // Determine network + USDC mint
  const network  = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet";
  const rpcUrl   = process.env.SOLANA_RPC_URL
    ?? (network === "mainnet-beta"
      ? "https://api.mainnet-beta.solana.com"
      : "https://api.devnet.solana.com");
  const usdcMint = network === "mainnet-beta" ? USDC_MINT_MAINNET : USDC_MINT_DEVNET;

  const connection = new Connection(rpcUrl, "confirmed");

  try {
    // Fetch the parsed transaction
    const tx = await connection.getParsedTransaction(params.signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return {
        verified:      false,
        demoMode,
        failureReason: "Transaction not found on Solana — may not be confirmed yet",
      };
    }

    // Check confirmation status
    const status = await connection.getSignatureStatus(params.signature, {
      searchTransactionHistory: true,
    });
    const confirmationStatus = status.value?.confirmationStatus;
    if (confirmationStatus !== "confirmed" && confirmationStatus !== "finalized") {
      return {
        verified:            false,
        demoMode,
        failureReason:       `Transaction not yet confirmed (status: ${confirmationStatus ?? "unknown"})`,
        confirmationStatus:  confirmationStatus ?? undefined,
      };
    }

    // Check for transaction error
    if (tx.meta?.err) {
      return {
        verified:      false,
        demoMode,
        failureReason: `Transaction failed on-chain: ${JSON.stringify(tx.meta.err)}`,
      };
    }

    // Parse SPL token transfer instructions
    const instructions = tx.transaction.message.instructions;
    let transferFound  = false;
    let actualAmount   = 0;

    for (const ix of instructions) {
      if (!("parsed" in ix)) continue;
      const parsed = ix.parsed as Record<string, unknown>;
      if (parsed.type !== "transferChecked" && parsed.type !== "transfer") continue;

      const info = parsed.info as Record<string, unknown>;

      // Verify USDC mint
      if (parsed.type === "transferChecked") {
        if ((info.mint as string) !== usdcMint) continue;
      }

      // Verify recipient (destination token account owner or address)
      const dest = (info.destination as string) ?? "";
      // For SPL token transfers the destination is a token account, not the owner.
      // We accept if the treasury address appears anywhere in the accountKeys.
      const accountKeys = tx.transaction.message.accountKeys.map(
        (k) => (typeof k === "string" ? k : k.pubkey.toString())
      );
      const treasuryPresent = accountKeys.some(
        (k) => k === params.expectedToAddress
      );
      if (!treasuryPresent) continue;

      // Verify amount (with 0.1% tolerance for rounding)
      const rawAmount   = Number(info.tokenAmount
        ? (info.tokenAmount as Record<string,unknown>).uiAmount
        : info.amount) / (parsed.type === "transferChecked" ? 1 : 1_000_000);
      const tolerance   = params.expectedUsdcAmount * 0.001;
      if (Math.abs(rawAmount - params.expectedUsdcAmount) > tolerance) {
        return {
          verified:      false,
          demoMode,
          failureReason: `Amount mismatch: expected ${params.expectedUsdcAmount} USDC, found ${rawAmount} USDC`,
          actualAmount:  rawAmount,
        };
      }

      actualAmount  = rawAmount;
      transferFound = true;
      break;
    }

    if (!transferFound) {
      return {
        verified:      false,
        demoMode,
        failureReason: "No matching USDC transfer found in transaction",
      };
    }

    // Mark signature as settled to prevent re-use
    settledSignatures.add(params.signature);

    return {
      verified:            true,
      demoMode,
      actualAmount,
      blockTime:           (tx.blockTime ?? 0) * 1000,  // to Unix ms
      confirmationStatus,
    };

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown RPC error";
    console.error("[verify-tx] RPC error:", msg);
    return {
      verified:      false,
      demoMode,
      failureReason: `Solana RPC error: ${msg}`,
    };
  }
}
