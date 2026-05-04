
import { NextResponse } from "next/server";
import { getUSDCBalance, FEE_WALLET } from "@/lib/solana";
import { computeLiquiditySnapshot } from "@/store/usePaymentStore";
import { MINIMUM_TREASURY_RESERVE_USDC } from "@/lib/payment-state";

export const runtime = "nodejs";

// Simple in-memory cache — treasury balance doesn't change that fast
let cachedBalance: { value: number; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 30_000; // 30s cache

export async function GET(): Promise<NextResponse> {
  // Check cache first
  if (cachedBalance && Date.now() - cachedBalance.fetchedAt < CACHE_TTL_MS) {
    const snapshot = computeLiquiditySnapshot(cachedBalance.value, 0);
    return NextResponse.json({
      ...snapshot,
      cached: true,
      minimumReserveUsdc: MINIMUM_TREASURY_RESERVE_USDC,
      canProcessPayments: snapshot.isHealthy,
    });
  }

  try {
    const treasuryAddress = FEE_WALLET.toString();

    // System program address means treasury isn't configured yet
    if (treasuryAddress === "11111111111111111111111111111111") {
      return NextResponse.json({
        treasuryBalance: 0,
        inFlightUsdc: 0,
        availableUsdc: 0,
        minimumReserve: MINIMUM_TREASURY_RESERVE_USDC,
        isHealthy: false,
        canProcessPayments: false,
        lastCheckedAt: Date.now(),
        warning: "Treasury wallet not configured. Set NEXT_PUBLIC_FEE_WALLET env var.",
      });
    }

    const balance = await getUSDCBalance(treasuryAddress);
    cachedBalance = { value: balance, fetchedAt: Date.now() };

    const snapshot = computeLiquiditySnapshot(balance, 0);

    return NextResponse.json({
      ...snapshot,
      cached: false,
      minimumReserveUsdc: MINIMUM_TREASURY_RESERVE_USDC,
      canProcessPayments: snapshot.isHealthy,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch treasury balance";
    console.error("[liquidity]", message);

    return NextResponse.json(
      {
        treasuryBalance: null,
        isHealthy: false,
        canProcessPayments: false,
        error: message,
        lastCheckedAt: Date.now(),
      },
      { status: 503 }
    );
  }
}
