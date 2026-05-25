/**
 * Solana Action — Pay with Auron (Blink)
 *
 * This endpoint implements the Solana Actions spec so payment links
 * from Auron work as interactive "Blinks" inside X/Twitter, Dialect,
 * Phantom, and any Blink-aware platform.
 *
 * Usage:
 *   GET  /api/actions/pay?to=rahul.sol&amount=500&currency=INR
 *        → Returns action metadata (title, icon, description, CTA)
 *
 *   POST /api/actions/pay?to=rahul.sol&amount=500&currency=INR
 *        body: { account: "BASE58_PAYER_PUBLIC_KEY" }
 *        → Returns { transaction: "BASE64_TX", message: "..." }
 *
 * The returned transaction is a partially-constructed USDC transfer
 * that the user's wallet signs and broadcasts.
 *
 * Spec: https://docs.dialect.to/documentation/solana-actions
 */

import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import { resolve as resolveSNS } from "@bonfida/spl-name-service";
import { isValidSolanaAddress } from "@/lib/solana";

// ─── Constants ────────────────────────────────────────────────────────────────

const APP_URL = "https://auron-mocha.vercel.app";
const ICON_URL = `${APP_URL}/icon-512.png`;
const RPC = process.env.NEXT_PUBLIC_HELIUS_RPC_URL
  ?? (process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com");

// USDC mint addresses
const USDC_MINT = process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta"
  ? new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
  : new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"); // devnet USDC (spl-token-faucet)

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Action-Version, X-Blockchain-Ids",
  "X-Action-Version": "2",
  "X-Blockchain-Ids": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveAddress(to: string): Promise<PublicKey> {
  if (isValidSolanaAddress(to)) return new PublicKey(to);
  if (to.endsWith(".sol")) {
    const connection = new Connection(RPC, "confirmed");
    const name = to.toLowerCase().replace(/\.sol$/, "");
    return await resolveSNS(connection, name);
  }
  throw new Error(`Cannot resolve: ${to}`);
}

function formatAmount(amount: number, currency: string): string {
  if (currency === "INR") return `₹${amount.toLocaleString("en-IN")}`;
  if (currency === "USDC") return `$${amount} USDC`;
  if (currency === "SOL") return `${amount} SOL`;
  return `${amount} ${currency}`;
}

// ─── GET — action metadata ─────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const to = searchParams.get("to") ?? "";
  const amount = parseFloat(searchParams.get("amount") ?? "0");
  const currency = (searchParams.get("currency") ?? "USDC").toUpperCase();
  const note = searchParams.get("note") ?? "";

  const displayTo = to.endsWith(".sol") ? to : to.slice(0, 6) + "…" + to.slice(-4);
  const displayAmount = formatAmount(amount, currency);

  const metadata = {
    icon: ICON_URL,
    label: `Pay ${displayAmount}`,
    title: `Pay ${displayAmount} via Auron`,
    description: note
      ? `${note} — powered by Auron on Solana`
      : `Send ${displayAmount} to ${displayTo} instantly via Auron. The blockchain is invisible.`,
    links: {
      actions: [
        {
          label: `Pay ${displayAmount}`,
          href: `/api/actions/pay?to=${encodeURIComponent(to)}&amount=${amount}&currency=${currency}${note ? `&note=${encodeURIComponent(note)}` : ""}`,
        },
      ],
    },
  };

  return NextResponse.json(metadata, { headers: CORS_HEADERS });
}

// ─── POST — build transaction ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const to = searchParams.get("to") ?? "";
  const amount = parseFloat(searchParams.get("amount") ?? "0");
  const currency = (searchParams.get("currency") ?? "USDC").toUpperCase();

  if (!to || !amount || amount <= 0) {
    return NextResponse.json(
      { error: "Missing required params: to, amount" },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  let body: { account: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: CORS_HEADERS });
  }

  const payerPubkey = new PublicKey(body.account);
  const connection = new Connection(RPC, "confirmed");

  try {
    const recipientPubkey = await resolveAddress(to);
    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    const tx = new Transaction({ recentBlockhash: blockhash, feePayer: payerPubkey });

    if (currency === "SOL") {
      // SOL transfer
      tx.add(
        SystemProgram.transfer({
          fromPubkey: payerPubkey,
          toPubkey: recipientPubkey,
          lamports: Math.round(amount * LAMPORTS_PER_SOL),
        })
      );
    } else {
      // USDC transfer (SPL token)
      const usdcAmount = currency === "INR"
        ? Math.round((amount / 83) * 1_000_000) // INR → USDC at ~83 rate, 6 decimals
        : Math.round(amount * 1_000_000);         // USDC, 6 decimals

      const fromATA = await getAssociatedTokenAddress(USDC_MINT, payerPubkey);
      const toATA = await getAssociatedTokenAddress(USDC_MINT, recipientPubkey);

      // Create recipient ATA if it doesn't exist
      try {
        await getAccount(connection, toATA);
      } catch {
        tx.add(
          createAssociatedTokenAccountInstruction(
            payerPubkey, toATA, recipientPubkey, USDC_MINT
          )
        );
      }

      tx.add(
        createTransferInstruction(fromATA, toATA, payerPubkey, usdcAmount)
      );
    }

    const serialized = tx.serialize({ requireAllSignatures: false });

    return NextResponse.json(
      {
        transaction: serialized.toString("base64"),
        message: `Payment via Auron · The blockchain is invisible`,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500, headers: CORS_HEADERS });
  }
}

// ─── OPTIONS — CORS preflight ──────────────────────────────────────────────────

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
