/**
 * POST /api/resolve-recipient
 *
 * Resolves a human-readable identifier to a Solana wallet address.
 * Handles two formats:
 *   1. .sol domains  → Solana Name Service (SNS) on-chain lookup
 *   2. Phone numbers → Supabase users table lookup
 *
 * Called client-side before building any transfer transaction.
 * Never exposes raw Supabase service key to the browser.
 */

import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { resolve as resolveSNS } from "@bonfida/spl-name-service";
import { createClient } from "@/lib/supabase/server";
import { isValidSolanaAddress } from "@/lib/solana";

// ─── Phone normalisation ──────────────────────────────────────────────────────
// Accepts: "9876543210", "+919876543210", "09876543210"
// Returns: "+919876543210" (E.164 for India)
function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");

  if (digits.length === 10) return `+91${digits}`;              // local Indian
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`; // 91XXXXXXXXXX
  if (digits.length === 13 && digits.startsWith("091")) return `+${digits.slice(1)}`; // 091XXXXXXXXXX
  return null;
}

function isPhoneNumber(input: string): boolean {
  // E.164 or bare 10-digit Indian number
  return /^\+?[\d\s\-().]{7,15}$/.test(input.trim());
}

function isSolDomain(input: string): boolean {
  return input.trim().toLowerCase().endsWith(".sol");
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: { recipient: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = (body.recipient ?? "").trim();

  if (!raw) {
    return NextResponse.json({ error: "recipient is required" }, { status: 400 });
  }

  // Already a valid Solana address — nothing to do
  if (isValidSolanaAddress(raw)) {
    return NextResponse.json({ address: raw, type: "wallet", display: raw });
  }

  // ── .sol domain resolution ────────────────────────────────────────────────
  if (isSolDomain(raw)) {
    try {
      const rpcUrl =
        process.env.NEXT_PUBLIC_HELIUS_RPC_URL ||
        (process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta"
          ? "https://api.mainnet-beta.solana.com"
          : "https://api.devnet.solana.com");

      const connection = new Connection(rpcUrl, "confirmed");
      const name = raw.toLowerCase().replace(/\.sol$/, "");

      const ownerKey: PublicKey = await resolveSNS(connection, name);

      return NextResponse.json({
        address: ownerKey.toString(),
        type: "sol_domain",
        display: raw.toLowerCase(),   // show "priya.sol" in UI, not the raw address
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "SNS lookup failed";
      // SNS throws if domain not found — surface as a user-friendly error
      if (msg.toLowerCase().includes("not found") || msg.toLowerCase().includes("no account")) {
        return NextResponse.json(
          { error: `"${raw}" is not registered on Solana Name Service.` },
          { status: 404 }
        );
      }
      return NextResponse.json({ error: `SNS lookup failed: ${msg}` }, { status: 502 });
    }
  }

  // ── Phone number resolution ───────────────────────────────────────────────
  if (isPhoneNumber(raw)) {
    const e164 = normalisePhone(raw);

    if (!e164) {
      return NextResponse.json(
        { error: `"${raw}" doesn't look like a valid Indian phone number.` },
        { status: 422 }
      );
    }

    try {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("users")
        .select("wallet_address, full_name")
        .eq("phone", e164)
        .single();

      if (error || !data?.wallet_address) {
        return NextResponse.json(
          {
            error: `No Auron account found for ${e164}. They need to sign up first.`,
            hint: "not_registered",
          },
          { status: 404 }
        );
      }

      return NextResponse.json({
        address: data.wallet_address,
        type: "phone",
        display: data.full_name ?? e164,   // show their name if we have it
        phone: e164,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "DB lookup failed";
      return NextResponse.json({ error: `Phone lookup failed: ${msg}` }, { status: 502 });
    }
  }

  // ── Unrecognised format ───────────────────────────────────────────────────
  return NextResponse.json(
    {
      error: `"${raw}" is not a valid Solana address, .sol domain, or phone number.`,
      hint: "invalid_format",
    },
    { status: 422 }
  );
}
