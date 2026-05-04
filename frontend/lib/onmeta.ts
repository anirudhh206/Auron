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
 * Auron earns: charges user ₹83.15/USDC, market rate ~₹84, keeps the spread.
 */

export const AURON_FX_RATE = 83.15; // INR per USDC — Auron's rate (below market = Auron earns spread)
export const MARKET_FX_RATE = 84.00; // approximate market rate

// Calculate how much USDC user needs to pay a given INR amount
export function inrToUsdc(inrAmount: number): number {
  return parseFloat((inrAmount / AURON_FX_RATE).toFixed(6));
}

// Calculate INR equivalent of USDC amount at Auron rate
export function usdcToInr(usdcAmount: number): number {
  return parseFloat((usdcAmount * AURON_FX_RATE).toFixed(2));
}

// Auron revenue per transaction (FX spread)
export function auronRevenue(inrAmount: number): number {
  const usdcCharged = inrToUsdc(inrAmount);
  const usdcAtMarket = inrAmount / MARKET_FX_RATE;
  return parseFloat(((usdcCharged - usdcAtMarket) * AURON_FX_RATE).toFixed(2));
}

// ─── OnMeta API types ─────────────────────────────────────────────────────────

export interface OnMetaQuote {
  inrAmount: number;
  usdcAmount: number;
  fxRate: number;
  onmetaFee: number; // OnMeta's ~0.5% fee
  auronFee: number;  // Auron's spread
  merchantGets: number; // final INR merchant receives
  estimatedTime: string;
}

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

// ─── Quote (no API call needed — computed locally) ───────────────────────────

export function getQuote(inrAmount: number): OnMetaQuote {
  const usdcAmount = inrToUsdc(inrAmount);
  const onmetaFee = parseFloat((usdcAmount * 0.005 * AURON_FX_RATE).toFixed(2)); // 0.5%
  const spread = auronRevenue(inrAmount);

  return {
    inrAmount,
    usdcAmount,
    fxRate: AURON_FX_RATE,
    onmetaFee,
    auronFee: spread,
    merchantGets: inrAmount - onmetaFee,
    estimatedTime: "10–30 seconds",
  };
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
      payoutId: `demo_${Date.now()}`,
      status: "completed",
      utrNumber: `UTR${Date.now()}`,
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
