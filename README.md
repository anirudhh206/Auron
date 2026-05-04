# AURON
### *Scan. Type. Pay. On Solana.*

> "You just used a blockchain for the first time — without knowing it."

---

## The Problem Nobody Is Solving

Every blockchain product built in the last 15 years was designed for people who already understand blockchain.

That's **500 million people.**

The other **8 billion** were left out — not because they couldn't benefit, but because nobody built for them. They don't know what a seed phrase is. They don't want to know. They shouldn't have to.

**Auron fixes this.**

---

## What Auron Is

Auron is a **conversational AI payment app** built on Solana. Scan any merchant QR code, type what you want to do, or speak it. Auron figures out the blockchain part — you get a receipt. The merchant gets INR. The blockchain is invisible.

```
User:   *scans a Swiggy QR code*
Auron:  ₹450 to Swiggy Merchant · Pay with 5.41 USDC?
User:   Confirm
Auron:  Done. Confirmed on Solana in 400ms. Merchant gets ₹450 INR.
        ↳ Fee: < $0.001. Recorded permanently.
```

No seed phrase confusion. No wallet addresses. No gas calculations. No crypto knowledge required.

It feels like Google Pay. It runs on Solana.

---

## Scan Any UPI QR Code and Pay to any merchant

India has 300 million+ merchants accepting UPI QR payments via Google Pay, PhonePe, Paytm. Every single one of them already has a QR code. Auron makes every one of those QR codes a crypto payment terminal — **without the merchant changing anything.**

```
User scans QR  →  Auron reads the UPI deep link  →  Confirms amount in ₹
        ↓
USDC sent on Solana via Jupiter  →  Off-ramp converts to INR
        ↓
Merchant receives ₹ in their existing UPI account. Done.
```

The merchant never touches crypto. The user never touches a wallet address. Auron handles everything in between — and earns via the FX spread.

---

## Five Things. Plain English.

| What you do | What Auron does |
|---|---|
| Scan a merchant QR code | Pays via USDC → INR in one tap |
| `"Send ₹500 to Priya"` | Transfers SOL or USDC on-chain in 400ms |
| `"Lock ₹2000 for 3 months"` | Creates a time-locked savings position |
| `"Arjun owes me ₹1,500 — record it"` | Stamps an immutable agreement on Solana via memo |
| `"Prove this photo is mine"` | SHA-256 hashes and timestamps your file on-chain |

Plain English in. Solana action out. Receipt always.

---

## The Receipt — The Most Important Moment

After every action, this appears:

```
┌──────────────────────────────────────────────────┐
│  What just happened                               │
│                                                   │
│  You sent ₹500 to Priya Sharma                   │
│                                                   │
│  Recorded on     Solana · Devnet                  │
│  Time            May 2, 2026 — 3:42 PM            │
│  Can be altered? No. Ever.                        │
│  Network fee     < $0.001                         │
│  Explorer        solscan.io/tx/...                │
│                                                   │
│  "A record nobody — not us, not your bank,        │
│   not any government — can change or delete."     │
└──────────────────────────────────────────────────┘
```

This is not an explanation of blockchain. This is an **experience** of it.

---

## How It Works

```
User types / scans QR / speaks
        ↓
Claude AI parses intent via SSE streaming (with prompt caching — 90% cost savings)
        ↓
6-layer security review (urgency detection, spend ceiling, scam check)
        ↓
Plain English confirmation shown to user
        ↓
Solana transaction built client-side (SOL transfer / SPL token transfer / memo)
        ↓
User signs with Phantom / Backpack / Solflare — single click
        ↓
Transaction confirmed on Solana (~400ms)
        ↓
Receipt appears — permanent, immutable, human-readable
```

### The AI Engine

Every message goes through Claude with a structured SSE intent stream:

```
"send 500 rupees to priya"
         ↓  Claude (cached system prompt, SSE streaming)
{
  action:    "transfer_usdc",
  amount_usdc: 6.01,          // ₹500 ÷ ₹83.15 per USDC
  recipient: "7xKp...mR4",
  confidence: 0.97
}
         ↓
SPL Token transfer → confirmed on Solana in ~400ms
```

---

## Built on Solana — Natively

Auron uses core Solana primitives and the Jupiter ecosystem:

| Feature | How Auron uses it |
|---|---|
| **SOL transfers** | Native Solana system program transfers — instant, near-zero fee |
| **USDC (SPL Token)** | Circle's USDC on Solana for stable-value payments |
| **Jupiter Aggregator** | Best-rate swaps with 0.3% platform fee to Auron treasury |
| **Solana Memo Program** | On-chain agreement and ownership stamps — immutable, human-readable |
| **Wallet Adapter** | Works with Phantom, Backpack, Solflare — one connect, everything works |

---

## Revenue Model

Auron earns on every transaction. Two streams:

### 1. Jupiter Platform Fee (0.3% per swap)
Every token swap routes through Jupiter with Auron's fee account set as the platform fee recipient. Automatic. On-chain. No invoice required.

```
User swaps 100 USDC → SOL
Jupiter routes best path
0.3 USDC → Auron fee wallet (automatic)
User gets SOL at best available rate
```

### 2. FX Spread on UPI Payments
Market rate: ~₹84.00 per USDC
Auron rate:   ₹83.15 per USDC (~1% spread)

```
User pays ₹450 to merchant
Auron converts at ₹83.15 → 5.41 USDC charged
Market rate would require 5.36 USDC
Gap of 0.05 USDC (~₹4.18) = Auron revenue per transaction
```

No subscriptions. No ads. No data selling. Pure transaction revenue — transparent and on-chain.

| Action | Fee |
|---|---|
| Token swap | 0.3% via Jupiter platform fee |
| UPI QR payment | ~1% FX spread |
| Agreement stamp | ₹5 flat (memo tx fee) |
| Ownership proof | ₹2 flat (memo tx fee) |

---

## Security — Six Layers

Most security is designed for experts. Ours is designed for people who've never thought about it.

| Layer | What It Does |
|---|---|
| **Intent Mirror** | Every action confirmed in plain English before execution. No exceptions. |
| **Scam Detector** | Urgency language triggers automatic slowdown. Every scam uses urgency. We remove it. |
| **Smart Limits** | User-set ceiling for instant sends. Above it — extra verification. |
| **Closed Signing** | Transactions only execute after explicit wallet confirmation. No auto-sign. |
| **PIN Protection** | argon2id hashed server-side. Never stored in plaintext. Ever. |
| **Daily Caps** | Configurable daily spend ceiling tracked in-session. Blocks cap-busting sequences. |

> *"We designed security for people who've never thought about security. That's harder than designing it for experts."*

---

## The Numbers

| | |
|---|---|
| Average transaction time | **~400ms** (Solana finality) |
| Average network fee | **< $0.001** per transaction |
| Seed phrases required | **0** |
| Wallets supported | **Phantom, Backpack, Solflare** |
| Prompt caching savings | **~90% AI cost reduction** |
| Estimated infra cost at 1,000 users/month | **~$60** |
| Target market | **8,000,000,000 people** |

---

## Competitive Landscape

|  | Traditional Banking | Crypto Wallets | **Auron** |
|---|---|---|---|
| Setup | Days | Seed phrase | **Connect Phantom (10 sec)** |
| Send money | Slow transfer | Wallet address | **"Send ₹500 to Priya"** |
| Pay merchants | UPI (INR only) | Not possible | **Scan any QR code** |
| Records | Bank can alter | Technical explorer | **Plain English receipt** |
| Security | Bank's rules | Your responsibility | **Built-in, automatic** |
| Target user | Everyone (poorly) | 500M crypto users | **8 billion people** |

**vs. other AI wallet UX projects** — They make DeFi smarter for crypto natives. Auron makes Solana accessible for people who have never heard of Solana. Different market. 16× larger.

---

## Tech Stack

```
Frontend        Next.js 15 (App Router) + TypeScript
Styling         Tailwind CSS v4 + Framer Motion
Fonts           Playfair Display + DM Sans
Auth            Supabase (Google OAuth + email/password + PIN)
Database        Supabase PostgreSQL (users, sessions, transactions, contacts)
Blockchain      Solana (devnet → mainnet-beta)
Wallet          @solana/wallet-adapter-react (Phantom, Backpack, Solflare)
Token           USDC SPL Token via @solana/spl-token
Swaps           Jupiter Aggregator API v6 (@jup-ag/api)
AI Engine       Anthropic Claude API with SSE streaming + prompt caching
QR Scanning     @zxing/browser — UPI QR deep-link parser
Security        argon2id PIN hashing, Vercel KV rate limiting, CSP headers
RPC             Helius (enterprise-grade Solana RPC)
Hosting         Vercel
```

---

## Solana Programs Used

| Program | Purpose |
|---|---|
| **System Program** | Native SOL transfers |
| **SPL Token Program** | USDC transfers (Associated Token Accounts) |
| **Memo Program** | Immutable agreement + ownership stamps on-chain |
| **Jupiter Aggregator** | Token swaps with platform fee |

All transactions are built client-side with `@solana/web3.js`, signed by the user's wallet, and submitted to Solana via Helius RPC.

---

---

## Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project
- An [Anthropic](https://console.anthropic.com) API key
- A [Helius](https://dev.helius.xyz) API key (free tier works)
- [Phantom](https://phantom.app) wallet browser extension (set to Devnet)

### Setup

```bash
# Clone
git clone https://github.com/your-org/auron
cd auron/frontend

# Install dependencies
npm install --legacy-peer-deps

# Configure environment
cp .env.local.example .env.local
```

Fill in `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=           # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=      # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY=          # Supabase service role key
ANTHROPIC_API_KEY=                  # Claude API key
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_HELIUS_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY
NEXT_PUBLIC_FEE_WALLET=             # Your Solana wallet public key (Jupiter fees)
```

```bash
# Run the database schema
# → Supabase Dashboard → SQL Editor → paste supabase/schema.sql → Run

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Switch to Mainnet

```bash
# In .env.local:
NEXT_PUBLIC_SOLANA_NETWORK=mainnet-beta
NEXT_PUBLIC_HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
```

---

## The Demo

When presenting Auron:

1. Open Auron on your phone — connect Phantom (devnet)
2. Say — *"Can I show you something? This takes 30 seconds."*
3. Point the camera at any UPI QR code (Swiggy, Zomato, any merchant)
4. Auron reads it — shows merchant name, amount, USDC breakdown, ₹0 fee
5. Tap **Pay**. Wallet signs. Done.
6. Take the phone back.
7. Say — **"You just used Solana to pay a merchant who doesn't know what Solana is."**
8. Silence. 3 seconds.
9. Say — *"Every QR code in India is now a Solana payment terminal. That's Auron."*

---

## Why This Wins at Colosseum

**1. Real on-chain transactions — not simulations**
Every action creates a verifiable Solana transaction. Judges can look it up on Solscan right there.

**2. Revenue from day one**
Jupiter platform fees flow directly to the fee wallet on-chain. No token dependency. No theoretical revenue.

**3. The QR scan demo is unlike anything else in the room**
Hand a judge your phone. They've paid a merchant on Solana before you say another word.

**4. The target market is 16× larger**
Every other project targets 500M crypto users. Auron targets 8 billion people who want to pay for things.

**5. We prove Solana's thesis for consumer payments**
Solana's pitch is fast, cheap, global transactions for everyone. Auron is the proof of concept — real users, real merchants, real money, zero crypto knowledge required.

---

## The Vision

Banks took 500 years to reach where they are.

Solana can do everything they do — faster, cheaper, permanent, and without anyone's permission — in 400 milliseconds.

The only thing missing was an interface that didn't require a computer science degree.

**That's Auron.**

Not a smarter wallet for crypto people.
The first wallet for everyone else.

---

<div align="center">

**Built on Solana. Powered by Claude. Made for everyone.**

*© 2026 Auron · Scan. Type. Pay.*

</div>
