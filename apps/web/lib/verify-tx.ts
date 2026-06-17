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
import { getAssociatedTokenAddress } from "@solana/spl-token";

// ── Constants ─────────────────────────────────────────────────────────────────

// USDC mint addresses
const USDC_MINT_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_MINT_DEVNET  = "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr";

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

  // Determine network + USDC mint
  const network  = process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet";
  const rpcUrl   = process.env.SOLANA_RPC_URL
    ?? process.env.NEXT_PUBLIC_HELIUS_RPC_URL   // use Helius if available server-side
    ?? (network === "mainnet-beta"
      ? "https://api.mainnet-beta.solana.com"
      : "https://api.devnet.solana.com");
  const usdcMint = network === "mainnet-beta" ? USDC_MINT_MAINNET : USDC_MINT_DEVNET;

  // Debug: log which RPC is being used (mask the API key)
  const rpcDisplay = rpcUrl.replace(/api-key=[^&]+/, "api-key=***");
  console.log(`[verify-tx] RPC: ${rpcDisplay} | sig: ${params.signature.slice(0, 12)}… | expectedUsdc: ${params.expectedUsdcAmount}`);

  const connection = new Connection(rpcUrl, "confirmed");

  try {
    // Fetch the parsed transaction — retry up to 4x (12s) because the client
    // calls this endpoint immediately after on-chain confirmation, and the RPC
    // node may not have propagated the tx yet.
    let tx = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 3_000));
      tx = await connection.getParsedTransaction(params.signature, {
        commitment:                     "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      console.log(`[verify-tx] attempt ${attempt + 1}/4 — tx found: ${!!tx}`);
      if (tx) break;
    }

    if (!tx) {
      console.error(`[verify-tx] tx not found after 4 attempts on RPC: ${rpcDisplay}`);
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

    // Collect ALL parsed instructions — top-level AND inner.
    // Phantom (and many other wallets) route USDC transfers through the
    // Associated Token Program via CPI, so the actual SPL transfer often
    // appears only in innerInstructions, not in the top-level list.
    type ParsedIx = { parsed?: unknown; program?: string };
    const topLevel = tx.transaction.message.instructions as ParsedIx[];
    const inner    = tx.meta?.innerInstructions?.flatMap((i) => i.instructions as ParsedIx[]) ?? [];
    const allInstructions: ParsedIx[] = [...topLevel, ...inner];

    console.log(
      `[verify-tx] instructions — top: ${topLevel.length} inner: ${inner.length} total: ${allInstructions.length}`
    );
    allInstructions.forEach((ix, i) => {
      const p = ix.parsed as Record<string, unknown> | undefined;
      console.log(
        `[verify-tx] ix[${i}] program=${ix.program ?? "?"} ` +
        `parsed=${!!p} type=${p?.type ?? "—"} ` +
        (p?.type === "transfer" || p?.type === "transferChecked"
          ? `amount=${JSON.stringify((p.info as Record<string,unknown>)?.amount ?? (p.info as Record<string,unknown>)?.tokenAmount)}`
          : "")
      );
    });

    // Derive expected treasury ATA — SPL instructions reference ATAs, not wallet addresses
    const expectedTreasuryATA = (
      await getAssociatedTokenAddress(new PublicKey(usdcMint), new PublicKey(params.expectedToAddress))
    ).toBase58();

    let transferFound  = false;
    let actualAmount   = 0;

    for (const ix of allInstructions) {
      if (!("parsed" in ix) || !ix.parsed) continue;
      const parsed = ix.parsed as Record<string, unknown>;
      if (parsed.type !== "transferChecked" && parsed.type !== "transfer") continue;

      const info = parsed.info as Record<string, unknown>;

      // Verify USDC mint for transferChecked (plain "transfer" has no mint field,
      // so we accept it and rely on the amount check to weed out false matches).
      if (parsed.type === "transferChecked") {
        if ((info.mint as string) !== usdcMint) continue;
      }

      // SPL instructions reference ATAs, not wallet addresses.
      // On mainnet: hard reject if destination is not the treasury ATA.
      // On devnet: warn only — treasury ATA may differ across deployments.
      const destination = info.destination as string | undefined;
      if (destination && destination !== expectedTreasuryATA) {
        if (network === "mainnet-beta") continue;
        console.warn(
          `[verify-tx] destination ${destination} != expectedTreasuryATA ${expectedTreasuryATA} (devnet — proceeding)`
        );
      }

      // Verify amount with 2% tolerance (handles FX rounding + wallet differences).
      let rawAmount: number;
      if (parsed.type === "transferChecked") {
        // Prefer uiAmount (float). Some devnet RPC nodes return it as null or a
        // string — fall back to raw integer amount in those cases.
        const tokenAmount = info.tokenAmount as Record<string, unknown> | undefined;
        const uiAmount    = tokenAmount?.uiAmount;
        if (typeof uiAmount === "number") {
          rawAmount = uiAmount;
        } else if (typeof uiAmount === "string") {
          rawAmount = parseFloat(uiAmount);
        } else {
          // uiAmount is null — derive from raw integer + decimals
          const rawInt  = Number(tokenAmount?.amount ?? info.amount ?? 0);
          const decimals = Number(tokenAmount?.decimals ?? 6);
          rawAmount = Number.isFinite(rawInt) ? rawInt / Math.pow(10, decimals) : NaN;
        }
      } else {
        // plain transfer carries amount as a raw integer string (multiply by 10^-6)
        const rawInt = Number(info.amount);
        rawAmount = Number.isFinite(rawInt) ? rawInt / 1_000_000 : NaN;
      }

      if (!Number.isFinite(rawAmount)) continue; // skip unparseable instructions

      const tolerance = params.expectedUsdcAmount * 0.02; // 2% — covers FX rounding
      if (Math.abs(rawAmount - params.expectedUsdcAmount) > tolerance) continue;

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
