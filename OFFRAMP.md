# Auron Off-Ramp — Activation Guide

> The off-ramp is **already integrated in code**. This document explains exactly what it takes to move from demo mode to live INR settlement.

---

## What's Built

`lib/onmeta.ts` contains a complete, production-ready integration with the OnMeta API:

- FX quote calculation (Auron earns ~1% spread)
- `initiateOnMetaPayout()` — real API call to `https://api.onmeta.in/v1/offramp/initiate`
- Webhook handler at `/api/webhooks/onmeta` (UTR confirmation, HMAC-verified)
- Settlement routing engine (`lib/routing.ts`) with Razorpay as automatic fallback
- Full payment state machine: `initiated → settling → completed` with audit trail in Supabase

**Demo mode is active by default** (`ONMETA_API_KEY=demo`). Flip one env var to go live.

---

## Live Activation Steps

### Step 1 — Get OnMeta KYB Approval

OnMeta is a licensed crypto off-ramp operating under India's VDA (Virtual Digital Asset) reporting framework.

1. Apply at [onmeta.in/business](https://onmeta.in/business)
2. Submit KYB documents:
   - Certificate of Incorporation
   - Director Aadhaar + PAN
   - Bank account proof (for treasury settlement)
   - Business address proof
3. OnMeta compliance review: **3–7 business days**
4. You receive: `ONMETA_API_KEY` + webhook secret

### Step 2 — Razorpay Activation (Fallback)

Razorpay is already integrated as the fallback provider. It handles UPI payouts under ₹10 lakh/day.

1. Create a Razorpay account at [dashboard.razorpay.com](https://dashboard.razorpay.com)
2. Complete KYC (business PAN, bank account)
3. Enable "Payout" product in dashboard
4. Get `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET`
5. Fund your Razorpay payout account (minimum ₹10,000 to start)

### Step 3 — Set Production Environment Variables

```bash
# OnMeta (primary — USDC → INR)
ONMETA_API_KEY=sk_live_xxxxxxxxxxxx
ONMETA_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx

# Razorpay (fallback — UPI payouts)
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxx

# Treasury wallet (where user USDC arrives before settlement)
NEXT_PUBLIC_FEE_WALLET=YOUR_MAINNET_SOLANA_WALLET
TREASURY_KEYPAIR_BASE58=YOUR_BASE58_PRIVATE_KEY
```

### Step 4 — Register Webhook Endpoint

In your OnMeta dashboard, set the webhook URL to:
```
https://your-domain.com/api/webhooks/onmeta
```

This endpoint is already built and HMAC-verified. It handles:
- `payout.completed` → marks transaction `completed`, stores UTR
- `payout.failed` → triggers Razorpay fallback retry

---

## Settlement Flow (Live Mode)

```
User pays ₹450 to merchant@paytm
        ↓
USDC transferred from user wallet → Auron treasury (on-chain, ~400ms)
        ↓
/api/v1/pay receives tx signature + merchant details
        ↓
OnMeta API: "pay ₹450 to merchant@paytm" (USDC already in treasury)
        ↓
OnMeta converts USDC → INR (10–30 seconds)
        ↓
Merchant receives ₹450 in their UPI account
        ↓
OnMeta sends webhook with UTR → Auron shows receipt
```

---

## Regulatory Coverage

OnMeta holds the following authorisations which **cover Auron's settlement operations**:

| Regulation | Coverage |
|---|---|
| AML/KYC | OnMeta performs KYC on the treasury account (Auron's business) |
| VDA Reporting | OnMeta files VDA transaction reports with Indian tax authorities |
| RBI Payment Framework | OnMeta is a licensed entity under RBI's payment framework |
| FEMA Compliance | FX conversion handled by OnMeta under FEMA guidelines |

**Auron's obligation:** KYC your own users (implemented in `lib/kyc.ts`) and enforce spend limits. The regulated fiat settlement layer is fully handled by OnMeta.

---

## Unit Economics (Live Mode)

| Payment size | Auron earns | OnMeta fee | Net per transaction |
|---|---|---|---|
| ₹100 | ₹1.00 (1% spread) | ~₹0.50 (0.5%) | **₹0.50** |
| ₹500 | ₹5.02 | ~₹2.50 | **₹2.52** |
| ₹2,000 | ₹20.10 | ~₹10.00 | **₹10.10** |

At 10,000 transactions/day averaging ₹400:
- Gross spread: **~₹40,000/day = ₹14.6M/year**
- OnMeta fees: ~₹20,000/day
- **Net: ~₹20,000/day = ₹7.3M/year (~$87,000 USD)**

Jupiter swap fees (0.3%) add on top for any USDC→SOL swap flows.

---

## Timeline to Live

| Task | Time |
|---|---|
| OnMeta KYB approval | 3–7 business days |
| Razorpay activation | Same day |
| Sumsub KYC setup | 1–2 days |
| Treasury wallet + funding | 1 hour |
| Mainnet deployment | 2 hours |
| **Total: live in production** | **~1 week** |
