# Auron — The Invisible Blockchain Payment App

> Scan it. Say it. Done.

Auron makes Solana payments feel like sending a WhatsApp message. Users scan any UPI QR code, say what they want in plain English, and the blockchain is completely invisible. Merchants receive INR instantly. Zero crypto knowledge required.

**[Live Demo](https://auron-mocha.vercel.app) · [Pay Link Demo](https://auron-mocha.vercel.app/pay/demo?amount=500&note=Lunch) · [Solana Blink](https://auron-mocha.vercel.app/api/actions/pay?to=demo&amount=500&currency=INR)**

---

## What Auron does

| Feature | How it works |
|---|---|
| **QR → Solana in 400ms** | Scan any Indian UPI QR code. Auron converts USDC to INR via the offramp and credits the merchant — no crypto setup needed on their end |
| **Conversational AI** | "Send ₹500 to Priya", "Lock ₹2000 for 3 months" — Claude AI parses natural language and builds the Solana transaction |
| **Savings vault** | Custom Anchor program on Solana. USDC is locked in a PDA — nobody can access it until the unlock time, enforced at the contract level |
| **Shareable pay links** | `/pay/rahul.sol?amount=500` — works on WhatsApp, Instagram bio, anywhere |
| **Solana Blinks** | Pay links work as interactive Blinks inside X/Twitter — click Pay without leaving the tweet |
| **Spending intelligence** | Ask "How much did I spend this week?" — Claude Haiku analyses your on-chain history and answers conversationally |
| **Mobile-first PWA** | Installable on Android. Phantom wallet works via deep link protocol |

---

## Architecture

```
User ──→ Next.js PWA ──→ Claude AI (intent parsing)
                    ├──→ Solana devnet (USDC transfers, savings vault, memo stamps)
                    ├──→ Auron treasury wallet
                    ├──→ OnMeta offramp (USDC → INR → UPI)
                    └──→ Supabase (transaction history, user auth)
```

### The invisible blockchain flow

```
User: "Scan Swiggy QR"
  → BarcodeDetector API reads UPI QR
  → Claude parses: {action: "upi_payment", inr_amount: 450, upi_id: "swiggy@upi"}
  → Risk assessment + pre-flight balance check
  → USDC transfer: User → Auron treasury (Solana devnet, ~400ms)
  → OnMeta offramp: USDC → INR → UPI credit to swiggy@upi
  → Merchant receives ₹450 via normal UPI
  → Receipt with SHA-256 hash stored on-chain
```

---

## Solana Programs

### Savings Vault (`programs/savings-vault/`)
Custom Anchor program. USDC is locked in a PDA — program-enforced, not database-enforced.

- **Program ID:** `B5DwqnCoDrY8ezfGaZfpAnvZ4FwCtPNHk6vT5nRgFENg` (devnet)
- **Instructions:** `lock_savings(amount, unlock_timestamp, label)` · `unlock_savings()`
- **PDA:** `[b"vault", owner_pubkey]` per user
- **Events:** `SavingsLocked` · `SavingsUnlocked` — indexable on-chain

```rust
// The vault is real — nobody can move these funds until the clock says so
pub fn lock_savings(ctx, amount: u64, unlock_timestamp: i64, label: String) -> Result<()>
pub fn unlock_savings(ctx) -> Result<()>
```

[View on Solscan (devnet)](https://solscan.io/account/B5DwqnCoDrY8ezfGaZfpAnvZ4FwCtPNHk6vT5nRgFENg?cluster=devnet)

### Agreement Stamps + Ownership Proofs
Uses the Solana Memo program. Immutable, timestamped by the chain, verifiable by anyone.

---

## Solana Blinks

Auron implements the full [Solana Actions spec](https://docs.dialect.to/documentation/solana-actions).

**Test a Blink:**
```
https://auron-mocha.vercel.app/api/actions/pay?to=demo&amount=500&currency=INR
```

**Manifest:** `https://auron-mocha.vercel.app/actions.json`

Any pay link (`/pay/address?amount=X`) is simultaneously:
- A human-readable payment page
- A Solana Blink that works inside X/Twitter, Dialect, Phantom

---

## Spending Intelligence

```
User: "How much did I spend this week?"
Claude Haiku: "You spent ₹3,840 this week across 12 transactions —
               ₹1,200 on Swiggy, ₹980 on Ola, ₹1,660 on other merchants."
```

Powered by Claude Haiku with prompt caching — 90% cost reduction vs uncached.

---

## Security Model

6 layers run before every transaction:

1. **Intent mirror** — You see exactly what will happen before anything executes
2. **Scam detector** — Urgency in messages triggers automatic slowdown
3. **Smart limits** — User-defined ceiling for instant sends
4. **Closed signing** — Only Auron can prompt your wallet
5. **Daily spend cap** — Hard ceiling, bounded exposure
6. **Risk scoring** — New recipients, unusual amounts, high frequency all flagged

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), Tailwind, Framer Motion |
| Wallet | Phantom (desktop + mobile deep link protocol) |
| Blockchain | Solana devnet — USDC SPL transfers + Anchor program |
| AI | Claude Sonnet (intent parsing, streaming SSE) + Claude Haiku (spending) |
| Auth | Supabase (Google OAuth + phone OTP) |
| QR scanning | Native BarcodeDetector API + @zxing fallback |
| Rate limiting | Vercel KV |
| PIN hashing | argon2id server-side |
| Mobile | PWA — installable on Android |

---

## Running Locally

```bash
cd frontend
npm install
cp .env.example .env.local
# Fill in: ANTHROPIC_API_KEY, NEXT_PUBLIC_HELIUS_RPC_URL, SUPABASE_*, CLAUDE_SYSTEM_PROMPT
npm run dev
```

**Deploy the Anchor program (devnet):**
```bash
# Requires WSL + Solana CLI + devnet SOL
# Get devnet SOL: https://faucet.solana.com
# Wallet: 92NtZCWPBCo2vgfeA1u37vQsemxZuqNZUTyyauro1MrP
bash deploy.sh
```

---

## Why Auron

**The problem:** 1.4 billion Indians use UPI. Zero of them pay with crypto. The UX gap is too big.

**The insight:** The blockchain doesn't need to be visible. Users pay like they always have — scan a QR, confirm. The settlement layer is invisible infrastructure.

**The differentiation:**
- Only app that makes every existing UPI QR a crypto payment terminal
- Conversational AI removes all crypto UX friction  
- Blinks make every payment link work inside social media
- Real on-chain savings vault — enforced by the Solana program, not a database

---

## Hackathon Notes

The QR scan → Solana USDC settlement is fully functional on devnet. INR delivery to the merchant is demonstrated in the app — mainnet requires an activated OnMeta/Transak partnership (next step post-hackathon).

All other features (savings vault, transfers, agreement stamps, ownership proofs, pay links, Blinks, spending intelligence) are fully functional.

---

Built for the **Colosseum Hackathon** · [auron-mocha.vercel.app](https://auron-mocha.vercel.app)
