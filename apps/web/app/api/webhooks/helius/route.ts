/**
 * POST /api/webhooks/helius — Real-Time Transaction Notifications
 *
 * Helius sends a POST to this endpoint the moment a watched transaction
 * reaches the configured commitment level (finalized). This replaces
 * polling-based verification with an event-driven model:
 *
 *   User signs → Helius detects → webhook fires → payment transitions to verified
 *
 * Setup in the Helius dashboard:
 *   1. Create a webhook of type "enhanced transactions"
 *   2. Set URL to: https://<your-domain>/api/webhooks/helius
 *   3. Add the Auron treasury wallet to the account address filter
 *   4. Set HELIUS_WEBHOOK_SECRET in env vars
 *
 * Security: Helius signs each request with HMAC-SHA256 using your webhook secret.
 * We verify the signature before processing any payload.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import {
  getTransactionBySignature,
  transitionTransaction,
  createSettlement,
} from "@/lib/db/ledger";

export const runtime = "nodejs";

// ── Helius payload types (enhanced transaction format) ────────────────────────

interface HeliusTokenTransfer {
  mint:            string;
  fromUserAccount: string;
  toUserAccount:   string;
  amount:          number;  // in token's smallest unit
  tokenStandard:   string;
}

interface HeliusTransaction {
  signature:      string;
  type:           string;        // "TRANSFER", "SWAP", etc.
  timestamp:      number;        // unix seconds
  feePayer:       string;
  tokenTransfers: HeliusTokenTransfer[];
  accountData:    unknown[];
  description:    string;
}

type HeliusPayload = HeliusTransaction[];

// ── USDC mint (devnet) ────────────────────────────────────────────────────────

const USDC_MINT_DEVNET  = "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr";
const USDC_MINT_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_DECIMALS     = 6;

// ── Signature verification ────────────────────────────────────────────────────

function verifyHeliusSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.HELIUS_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[helius-webhook] HELIUS_WEBHOOK_SECRET not set — skipping verification");
    return true; // allow in dev without secret
  }
  if (!signature) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody  = await req.text();
  const signature = req.headers.get("helius-signature");

  if (!verifyHeliusSignature(rawBody, signature)) {
    console.warn("[helius-webhook] Invalid signature — rejecting request");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: HeliusPayload;
  try {
    payload = JSON.parse(rawBody) as HeliusPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const treasury = process.env.NEXT_PUBLIC_FEE_WALLET ?? "";
  const results  = await Promise.allSettled(payload.map((tx) => processTransaction(tx, treasury)));

  const processed = results.filter((r) => r.status === "fulfilled").length;
  const failed    = results.filter((r) => r.status === "rejected").length;

  console.log(`[helius-webhook] Processed ${processed}/${payload.length} txs (${failed} errors)`);
  return NextResponse.json({ processed, failed });
}

// ── Process a single enhanced transaction ─────────────────────────────────────

async function processTransaction(tx: HeliusTransaction, treasury: string): Promise<void> {
  const sig = tx.signature;

  // Only process USDC transfers into the treasury
  const usdcTransfer = tx.tokenTransfers.find(
    (t) =>
      (t.mint === USDC_MINT_DEVNET || t.mint === USDC_MINT_MAINNET) &&
      t.toUserAccount === treasury &&
      t.amount > 0
  );

  if (!usdcTransfer) {
    // Not a relevant transfer — ignore silently
    return;
  }

  const usdcAmount = usdcTransfer.amount / 10 ** USDC_DECIMALS;

  console.log(
    `[helius-webhook] USDC transfer detected sig=${sig.slice(0, 12)}… ` +
    `amount=${usdcAmount} from=${usdcTransfer.fromUserAccount.slice(0, 8)}…`
  );

  // Look up the pending payment by tx signature
  const txnResult = await getTransactionBySignature(sig);
  if (!txnResult.ok) {
    // This can happen for treasury top-ups or external transfers — not an error
    console.log(`[helius-webhook] No pending payment for sig=${sig.slice(0, 12)}… — skipping`);
    return;
  }

  const txn = txnResult.data;

  // Only advance payments that are in "signed" state (waiting for on-chain confirmation)
  if (txn.status !== "signed") {
    console.log(`[helius-webhook] Payment ${txn.payment_id} already in state=${txn.status} — skipping`);
    return;
  }

  // Transition to verified — Helius has confirmed finalized commitment
  await transitionTransaction(txn.id, "verified", {
    reason: `On-chain USDC transfer confirmed via Helius webhook at T+${Date.now() - tx.timestamp * 1000}ms`,
  });

  // Create a settlement record in pending state for the worker to pick up
  await createSettlement({ transaction_id: txn.id, provider: txn.provider ?? "onmeta", status: "pending" });

  console.log(
    `[helius-webhook] Payment ${txn.payment_id} advanced → verified ` +
    `usdc=${usdcAmount} sig=${sig.slice(0, 12)}…`
  );
}
