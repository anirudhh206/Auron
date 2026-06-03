# Razorpay Integration Setup Guide

This guide walks you through setting up real end-to-end payments with Razorpay in 5 minutes.

## ✅ Step 1: Get Razorpay Credentials (2 minutes)

1. Go to **https://razorpay.com**
2. Click **"Sign Up for Free"** → create account with email + password
3. Complete email verification
4. Go to **Dashboard** → left sidebar → **Settings** → **API Keys**
5. Copy these two values:
   - **Key ID** (starts with `rzp_test_`)
   - **Key Secret** (long string)

> **Note**: You don't need KYB for sandbox/test mode. Production requires KYB but will be 1-2 weeks.

## ✅ Step 2: Create `.env.local` (1 minute)

In `D:\Auron\frontend\`, create a file called `.env.local` and paste:

```env
# Solana
NEXT_PUBLIC_SOLANA_NETWORK=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_FEE_WALLET=G2FAbFQPFa5qKXCetoFZQEvF9TdM4yE6UwqroeN9BCWQ

# Razorpay (from Step 1)
RAZORPAY_KEY_ID=rzp_test_XXXXX    ← replace with YOUR key
RAZORPAY_KEY_SECRET=XXXXX           ← replace with YOUR secret

# Demo mode OFF = real payouts
DEMO_SETTLEMENT=false

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## ✅ Step 3: Verify Razorpay Connection (1 minute)

```bash
cd D:\Auron\frontend
npx ts-node scripts/test-razorpay.ts
```

You should see:
```
✅ PASSED: Found credentials
✅ PASSED: Payout initiated successfully
   Payout ID: pout_XXXXX
   Status: processed
   UTR: (UTR number)
✅ PASSED: Idempotency works
✅ All tests passed!
```

If you see errors, check:
- Credentials are copied correctly (no spaces)
- `RAZORPAY_KEY_ID` starts with `rzp_test_`
- `.env.local` is in the right directory

## ✅ Step 4: Get Devnet USDC (1 minute)

You need devnet USDC to make payments:

```bash
# Get devnet USDC from the faucet
# Go to: https://spl-token-faucet.com
# - Network: Devnet
# - Token: USDC
# - Your wallet address (from Phantom)
# - Get 10 USDC (free)

# Also get devnet SOL for tx fees:
# Go to: https://faucet.solana.com
# - Paste your wallet address
# - Request 2 SOL (free)
```

## ✅ Step 5: Test End-to-End Payment

1. Start the app:
   ```bash
   npm run dev
   ```

2. Connect Phantom wallet (devnet)
3. Say: **"Pay ₹100 to auron-test@okhdfcbank"**
4. Confirm payment
5. Sign in Phantom
6. Watch the payment flow:
   - ✅ Quote created (server-side exchange rate)
   - ✅ Risk check passes
   - ✅ Solana TX confirmed (verifiable on Solscan)
   - ✅ Razorpay processes UPI
   - ✅ Receipt shows UTR number

## 📊 What Happens Behind the Scenes

1. **Quote Authority** — Server computes USDC from live rate + 0.85% spread
2. **Risk Engine** — Checks velocity, daily cap, new recipient
3. **Solana TX** — Real devnet USDC moves to treasury
4. **TX Verification** — Server verifies TX on-chain before payout
5. **Razorpay** — UPI transfer via Razorpay Payouts API
6. **Audit Trail** — Every step logged with timestamps

## 🔍 Debugging

**"RAZORPAY_KEY_SECRET not set"**
- Check `.env.local` exists and has the correct values
- Restart the dev server after creating `.env.local`

**"Razorpay payout failed: Invalid UPI handle"**
- The test UPI `auron-test@okhdfcbank` is Razorpay's test account
- For real UPI IDs, replace with actual merchant UPI in the message

**"Payout in pending status"**
- Some test UPI IDs take a few seconds
- Check Razorpay dashboard → Payouts → see the payout status

## 🚀 What's Next

Once this works:
1. **Screenshot the receipt** with UTR number → that's your proof for judges
2. **Record a 60-second video** of the full flow
3. **Deploy to Vercel** with the same env vars
4. **Show judges the live demo** — they'll see real Solana + real UPI

## 📝 Judging Criteria

When judges test:
- ✅ Real Solana TX (verifiable on Solscan devnet)
- ✅ Real UPI delivery (UTR number in receipt)
- ✅ Full state machine (quote → risk → sign → verify → settle)
- ✅ Audit trail (logs show every step)

This setup proves you can ship a full payment product end-to-end.

---

**Questions?** Check the logs in terminal — every payout prints detailed debug info.
