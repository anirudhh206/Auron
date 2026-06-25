/**
 * GET /api/v1/quote — Live FX Quote
 *
 * Returns a live USDC→fiat quote with a 60-second TTL.
 * The quoted rate is guaranteed for settlement if POST /api/v1/pay is called
 * within the TTL. Calls outside the TTL receive a 422 FX_EXPIRED error.
 *
 * Query params:
 *   usdc        — USDC amount to convert (required)
 *   corridor    — corridor ID, e.g. "upi_india" (default: auto-detect from recipient)
 *   recipient   — recipient identifier for auto-detection (optional)
 *
 * Example:
 *   GET /api/v1/quote?usdc=10&corridor=upi_india
 *   GET /api/v1/quote?usdc=10&recipient=merchant@paytm
 */

import { NextRequest, NextResponse } from "next/server";
import { getCorridor, detectCorridor, listCorridors } from "@/lib/corridors";

export const runtime = "nodejs";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;

  const usdcParam   = searchParams.get("usdc");
  const corridorId  = searchParams.get("corridor");
  const recipientId = searchParams.get("recipient");

  // ── Validate USDC amount ──────────────────────────────────────────────────
  if (!usdcParam) {
    return NextResponse.json(
      { error: "usdc query param is required", example: "/api/v1/quote?usdc=10&corridor=upi_india" },
      { status: 400 }
    );
  }

  const usdcAmount = parseFloat(usdcParam);
  if (isNaN(usdcAmount) || usdcAmount <= 0) {
    return NextResponse.json({ error: "usdc must be a positive number" }, { status: 400 });
  }

  // ── Resolve corridor ──────────────────────────────────────────────────────
  let corridor;
  try {
    if (corridorId) {
      corridor = getCorridor(corridorId);
    } else if (recipientId) {
      corridor = detectCorridor(recipientId);
      if (!corridor) {
        return NextResponse.json(
          {
            error:       "Cannot auto-detect corridor from recipient format",
            hint:        "Pass corridor= explicitly, or check /api/v1/corridors for supported formats",
            corridors:   listCorridors().map((c) => c.id),
          },
          { status: 422 }
        );
      }
    } else {
      // Default to UPI India if no corridor or recipient provided
      corridor = getCorridor("upi_india");
    }
  } catch (err) {
    return NextResponse.json(
      {
        error:     err instanceof Error ? err.message : "Unknown corridor",
        corridors: listCorridors().map((c) => c.id),
      },
      { status: 400 }
    );
  }

  // ── Check corridor is live ────────────────────────────────────────────────
  if (corridor.meta.status !== "live") {
    return NextResponse.json(
      {
        error:   `Corridor "${corridor.meta.id}" is ${corridor.meta.status} — not yet available`,
        status:  corridor.meta.status,
      },
      { status: 503 }
    );
  }

  // ── Check amount limits ───────────────────────────────────────────────────
  if (usdcAmount < corridor.meta.minUsdcAmount) {
    return NextResponse.json(
      { error: `Minimum amount is ${corridor.meta.minUsdcAmount} USDC`, corridor: corridor.meta.id },
      { status: 422 }
    );
  }
  if (usdcAmount > corridor.meta.maxUsdcAmount) {
    return NextResponse.json(
      { error: `Maximum amount is ${corridor.meta.maxUsdcAmount} USDC`, corridor: corridor.meta.id },
      { status: 422 }
    );
  }

  // ── Get live quote ────────────────────────────────────────────────────────
  try {
    const quote = await corridor.quote({ usdcAmount, recipientId: recipientId ?? undefined });

    return NextResponse.json({
      corridorId:   corridor.meta.id,
      corridorName: corridor.meta.name,
      currency:     corridor.meta.currency,
      usdc:         usdcAmount,
      fiat:         quote.fiatAmount,
      fxRate:       quote.fxRate,
      feeUsdc:      parseFloat(quote.feeUsdc.toFixed(4)),
      feeRate:      corridor.meta.feeRate,
      expiresAt:    quote.expiresAt,
      expiresIn:    quote.expiresAt - Math.floor(Date.now() / 1_000),
      ttlSeconds:   60,
    });
  } catch (err) {
    console.error("[v1/quote] Quote failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Quote unavailable" },
      { status: 503 }
    );
  }
}

// ── Corridors list ────────────────────────────────────────────────────────────

export async function HEAD(): Promise<NextResponse> {
  return new NextResponse(null, { status: 200 });
}
