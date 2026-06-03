/**
 * /api/quote — Server-side quote engine
 *
 * Claude parses intent and returns { inr_amount, upi_id, merchant_name }.
 * The client posts here to get an authoritative USDC quote.
 * The server fetches the live rate, applies spread, and returns a signed quote.
 *
 * POST body:
 *   { inrAmount: number, merchantUpiId: string, merchantName: string }
 *
 * Response:
 *   Quote — see lib/quote.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { buildQuote, FALLBACK_RATE_INR } from "@/lib/quote";

export const runtime = "nodejs";

// ── Validation ────────────────────────────────────────────────────────────────

function validate(body: unknown): {
  ok: true;
  inrAmount: number;
  merchantUpiId: string;
  merchantName: string;
} | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "Body must be a JSON object" };
  const b = body as Record<string, unknown>;

  if (typeof b.inrAmount !== "number" || b.inrAmount <= 0)
    return { ok: false, error: "inrAmount must be a positive number" };
  if (b.inrAmount > 200_000)
    return { ok: false, error: "inrAmount exceeds maximum of ₹2,00,000 per transaction" };
  if (typeof b.merchantUpiId !== "string" || !b.merchantUpiId.includes("@"))
    return { ok: false, error: "merchantUpiId must be a valid UPI ID (contains @)" };
  if (typeof b.merchantName !== "string" || !b.merchantName.trim())
    return { ok: false, error: "merchantName is required" };

  return {
    ok: true,
    inrAmount:     b.inrAmount as number,
    merchantUpiId: (b.merchantUpiId as string).trim(),
    merchantName:  (b.merchantName  as string).trim(),
  };
}

// ── Rate fetch (reuses /api/rate logic) ───────────────────────────────────────

async function fetchMarketRate(): Promise<number> {
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const res    = await fetch(`${appUrl}/api/rate`, {
      next: { revalidate: 30 },       // cache for 30s — quotes refresh anyway
    });
    if (!res.ok) throw new Error(`Rate API ${res.status}`);
    const data   = await res.json() as { marketRate?: number };
    return data.marketRate ?? FALLBACK_RATE_INR;
  } catch {
    console.warn("[quote] Could not fetch live rate — using fallback");
    return FALLBACK_RATE_INR;
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const validation = validate(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { inrAmount, merchantUpiId, merchantName } = validation;
  const marketRate = await fetchMarketRate();

  const quote = buildQuote({ inrAmount, merchantUpiId, merchantName, marketRate });

  console.log(
    `[quote] quoteId=${quote.quoteId} inr=₹${inrAmount} ` +
    `usdc=${quote.usdcAmount} rate=${quote.auronRate} merchant=${merchantUpiId}`
  );

  return NextResponse.json(quote);
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
