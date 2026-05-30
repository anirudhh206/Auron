/**
 * OnMeta Off-Ramp Integration
 *
 * OnMeta is a licensed crypto off-ramp operating in India.
 * They accept USDC and pay INR directly to a merchant's UPI account.
 *
 * Flow:
 *   Auron receives USDC from user's wallet
 *   Auron calls OnMeta: "send ₹450 to merchant@paytm"
 *   OnMeta converts USDC → INR and pays via UPI
 *   Merchant receives INR in their existing UPI account
 *
 * FX rates come from /api/rate (CoinGecko, 60s cache) — never hardcoded here.
 * Quote authority lives in lib/quote.ts + /api/quote.
 */

// ─── OnMeta API types ─────────────────────────────────────────────────────────

export interface OnMetaPayoutRequest {
  usdcAmount: number;
  merchantUpiId: string;
  merchantName: string;
  inrAmount: number;
  txSignature: string; // Solana tx that sent USDC to Auron treasury
  userId: string;
}

export interface OnMetaPayoutResult {
  success: boolean;
  payoutId: string;
  status: "pending" | "processing" | "completed" | "failed";
  utrNumber?: string; // UPI transaction reference
  estimatedDelivery: string;
}

// ─── Payout (server-side only — calls OnMeta API) ────────────────────────────

export async function initiateOnMetaPayout(
  req: OnMetaPayoutRequest
): Promise<OnMetaPayoutResult> {
  const apiKey = process.env.ONMETA_API_KEY;

  // ── No API key = sandbox/demo mode ───────────────────────────────────────
  if (!apiKey || apiKey === "demo") {
    console.log("[OnMeta DEMO] Simulating payout:", req);
    await new Promise(r => setTimeout(r, 800)); // simulate network delay
    return {
      success: true,
      payoutId: `demo_payout_${Date.now()}`,
      status: "completed",
      utrNumber: `DEMO_${Date.now()}`,   // clearly prefixed — never confused with real bank UTRs
      estimatedDelivery: "Completed (demo)",
    };
  }

  // ── Real OnMeta API call ──────────────────────────────────────────────────
  const res = await fetch("https://api.onmeta.in/v1/offramp/initiate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      amount_usdc: req.usdcAmount,
      upi_id: req.merchantUpiId,
      beneficiary_name: req.merchantName,
      reference_id: req.txSignature,
      fiat_amount: req.inrAmount,
      currency: "INR",
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`OnMeta API error: ${(err as any).message ?? res.statusText}`);
  }

  const data = await res.json() as any;
  return {
    success: true,
    payoutId: data.payout_id ?? data.id,
    status: data.status ?? "processing",
    utrNumber: data.utr,
    estimatedDelivery: data.estimated_delivery ?? "10–30 seconds",
  };
}
