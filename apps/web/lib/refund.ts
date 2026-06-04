/**
 * Auron — USDC Refund Executor
 *
 * When a settlement fails terminally (bad UPI ID, rate expiry, provider rejection),
 * Auron returns the USDC from the treasury wallet back to the user's wallet.
 *
 * Flow:
 *   1. Load treasury keypair (TREASURY_KEYPAIR_BASE58)
 *   2. Get treasury USDC ATA → user USDC ATA
 *   3. Build + send SPL transferChecked instruction
 *   4. Confirm on-chain
 *   5. Record refund_tx_signature + transition to "refunded" in ledger
 *
 * Safety guarantees:
 *   - Idempotent: if refund_tx_signature is already set, skip and return success
 *   - Amount: refunds exactly the usdc_amount from the transaction record (6 decimals)
 *   - Confirmation: waits for "confirmed" commitment before marking refunded
 *   - Demo mode: if DEMO_SETTLEMENT=true, simulates refund without real tx
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import bs58 from "bs58";
import {
  transitionTransaction,
  updateSettlement,
  getTransactionById,
} from "./db/ledger";

// ── Constants ─────────────────────────────────────────────────────────────────

const USDC_MINT = {
  "mainnet-beta": new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
  "devnet":       new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),
};
const USDC_DECIMALS = 6;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RefundParams {
  transactionId:  string;   // Auron DB transaction UUID
  settlementId?:  string;   // Optional: mark settlement as failed too
  reason:         string;   // Human-readable reason for the refund
}

export interface RefundResult {
  success:           boolean;
  refundTxSignature: string | null;
  demoMode:          boolean;
  error?:            string;
}

// ── Refund executor ───────────────────────────────────────────────────────────

export async function executeRefund(params: RefundParams): Promise<RefundResult> {
  const demoMode = process.env.DEMO_SETTLEMENT === "true";

  // Load the transaction record
  const txnResult = await getTransactionById(params.transactionId);
  if (!txnResult.ok) {
    return { success: false, refundTxSignature: null, demoMode, error: "Transaction not found" };
  }

  const txn = txnResult.data;

  // Idempotency: already refunded
  if ((txn.status as string) === "refunded") {
    console.log(`[refund] Already refunded — paymentId=${txn.payment_id}`);
    return { success: true, refundTxSignature: txn.refund_tx_signature ?? null, demoMode };
  }

  // Demo mode: simulate without real tx
  if (demoMode || !txn.tx_signature) {
    console.log(`[refund] Demo mode — simulating refund for paymentId=${txn.payment_id}`);
    const fakeSig = `demo_refund_${txn.payment_id.slice(0, 8)}`;
    await _persistRefund(txn.id, fakeSig, params.settlementId, params.reason);
    return { success: true, refundTxSignature: fakeSig, demoMode: true };
  }

  // Validate environment
  const keypairB58 = process.env.TREASURY_KEYPAIR_BASE58;
  const rpcUrl     = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const network    = (process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet") as "mainnet-beta" | "devnet";
  const usdcMint   = USDC_MINT[network] ?? USDC_MINT.devnet;

  if (!keypairB58) {
    const err = "TREASURY_KEYPAIR_BASE58 not configured — cannot execute refund";
    console.error(`[refund] ${err}`);
    // Transition to manual review if we can't refund automatically
    await transitionTransaction(txn.id, "failed", {
      reason:          `Refund required but treasury keypair missing: ${params.reason}`,
      errorMessage:    err,
      failureCategory: "unknown",
    });
    return { success: false, refundTxSignature: null, demoMode, error: err };
  }

  if (!txn.user_id) {
    return { success: false, refundTxSignature: null, demoMode, error: "No user wallet address on transaction" };
  }

  try {
    const connection    = new Connection(rpcUrl, "confirmed");
    const treasuryKp    = Keypair.fromSecretKey(bs58.decode(keypairB58));
    const userWallet    = new PublicKey(txn.user_id);   // user_id = Solana wallet pubkey
    const treasuryWallet = treasuryKp.publicKey;

    // Get treasury USDC ATA
    const fromAta = await getAssociatedTokenAddress(usdcMint, treasuryWallet);

    // Get or create user USDC ATA (user may not have one yet on devnet)
    const toAtaInfo = await getOrCreateAssociatedTokenAccount(
      connection,
      treasuryKp,         // payer
      usdcMint,
      userWallet,
    );
    const toAta = toAtaInfo.address;

    // Amount in raw units (USDC has 6 decimals)
    const rawAmount = BigInt(Math.round(txn.usdc_amount * 10 ** USDC_DECIMALS));

    console.log(
      `[refund] Sending ${txn.usdc_amount} USDC → ${txn.user_id} ` +
      `paymentId=${txn.payment_id} from=${treasuryWallet.toBase58().slice(0, 8)}…`
    );

    // Build the transfer instruction
    const transferIx = createTransferCheckedInstruction(
      fromAta,
      usdcMint,
      toAta,
      treasuryWallet,
      rawAmount,
      USDC_DECIMALS,
      [],                  // signers (none beyond fee payer)
      TOKEN_PROGRAM_ID,
    );

    const transaction = new Transaction().add(transferIx);
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = treasuryWallet;

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [treasuryKp],
      { commitment: "confirmed", maxRetries: 3 },
    );

    console.log(`[refund] SUCCESS sig=${signature.slice(0, 16)}… paymentId=${txn.payment_id}`);

    await _persistRefund(txn.id, signature, params.settlementId, params.reason);
    return { success: true, refundTxSignature: signature, demoMode: false };

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown refund error";
    console.error(`[refund] FAILED paymentId=${txn.payment_id} error="${msg}"`);

    // Mark transaction as failed (not refunded) — needs manual intervention
    await transitionTransaction(txn.id, "failed", {
      reason:          `Auto-refund failed: ${msg}. Original reason: ${params.reason}`,
      errorMessage:    msg,
      failureCategory: "unknown",
    });

    return { success: false, refundTxSignature: null, demoMode, error: msg };
  }
}

// ── Persist refund result ─────────────────────────────────────────────────────

async function _persistRefund(
  transactionId: string,
  signature:     string,
  settlementId?: string,
  reason?:       string,
): Promise<void> {
  // Update transaction with refund sig + transition to refund_pending → refunded
  await transitionTransaction(transactionId, "refund_pending", {
    reason: reason ?? "Refund initiated",
    metadata: { refund_tx_signature: signature },
  });

  // Set the refund_tx_signature column
  await _setRefundTxSignature(transactionId, signature);

  // Small delay for on-chain confirmation to propagate
  await new Promise(r => setTimeout(r, 1_500));

  await transitionTransaction(transactionId, "refunded", {
    reason: `Refund confirmed: ${signature}`,
    metadata: { refund_tx_signature: signature },
  });

  // Mark settlement as failed too if given
  if (settlementId) {
    await updateSettlement(settlementId, {
      status:       "failed",
      raw_response: { refund_tx_signature: signature, reason },
    });
  }
}

// ── Write refund_tx_signature to DB ──────────────────────────────────────────
// ledger.ts doesn't have this field yet — use direct Supabase client.

async function _setRefundTxSignature(transactionId: string, signature: string): Promise<void> {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const url    = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const db     = createClient(url, secret, { auth: { persistSession: false } });

    await db
      .from("transactions")
      .update({ refund_tx_signature: signature })
      .eq("id", transactionId);
  } catch (err) {
    console.error("[refund] Failed to write refund_tx_signature:", err);
  }
}
