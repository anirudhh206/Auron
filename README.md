# AURON
### *Your money, your words.*

> "You just used a blockchain for the first time — without knowing it."

---

## The Problem Nobody Is Solving

Every blockchain product built in the last 15 years was designed for people who already understand blockchain.

That's **500 million people.**

The other **8 billion** were left out — not because they couldn't benefit, but because nobody built for them. They don't know what a seed phrase is. They don't want to know. They shouldn't have to.

**Auron fixes this.**

---

## What Auron Is

Auron is a **conversational AI interface** built on the Initia blockchain. You type what you want. It happens. The blockchain is completely invisible — until a receipt appears telling you exactly what was recorded, permanently, and who can never change it.

```
User:   "Send ₹500 to Priya"
Auron:  Done. Permanently recorded. Here's your receipt.
        ↳ 4 seconds. ₹0.02 fee. Immutable forever.
```

No wallet setup. No seed phrases. No gas fee confusion. No crypto knowledge required.

It feels like WhatsApp. It works like a bank. It runs on a blockchain.

---

## Four Things. Plain English.

| What you type | What Auron does |
|---|---|
| `"Send ₹500 to Priya"` | Transfers funds on-chain in ~4 seconds |
| `"Lock ₹10,000 for 3 months"` | Creates a timelock vault earning 12% APY |
| `"Arjun owes me ₹1,500 — record it"` | Stamps an immutable agreement on-chain |
| `"Prove this photo is mine"` | Hashes and timestamps your file permanently |

Plain English in. Blockchain action out. Receipt always.

---

## The Receipt — The Most Important Moment

After every action, this appears:

```
┌──────────────────────────────────────────────────┐
│  What just happened                               │
│                                                   │
│  You sent ₹500 to Priya Sharma                   │
│                                                   │
│  Recorded on     Auron · Initia blockchain        │
│  Time            Apr 21, 2026 — 3:42 PM           │
│  Can be altered?   No. Ever.                     │
│  Fee paid        ₹0.02                            │
│                                                   │
│  "A record nobody — not us, not your bank,        │
│   not any government — can change or delete."     │
└──────────────────────────────────────────────────┘
```

This is not an explanation of blockchain. This is an **experience** of it. For most people, this is the first time blockchain becomes real.

---

## How It Works

```
User types natural language
        ↓
Claude AI parses intent (with prompt caching — 90% cost savings)
        ↓
6-layer security review
        ↓
Plain English confirmation shown to user
        ↓
CosmWasm smart contract executes on Initia
        ↓
Receipt appears — permanent, immutable, human-readable
```

### The AI Engine

Every message goes through Claude with a structured intent parser:

```
"send 500 to priya"
         ↓  Claude (cached system prompt)
{
  action:    "transfer",
  amount:    500,
  recipient: "priya.init",
  currency:  "INR"
}
         ↓
CosmWasm contract → on-chain in 4 seconds
```

---

## Built on Initia — Natively

Auron uses **three Initia-native features** that make the invisible blockchain possible:

| Feature | How Auron uses it |
|---|---|
| **Auto-signing** | Transactions fire without approval popups. Zero interruption. |
| **.init Usernames** | Users send to `priya.init`, not `init1x4f9abc...`. Human identity. |
| **Interwoven Bridge** | Frictionless funding on first login. No manual bridging. |

These aren't bolt-ons. They're core to why Auron works.

---

## Security — Six Layers

Most security is designed for experts. Ours is designed for people who've never thought about it.

| Layer | What It Does |
|---|---|
| **Intent Mirror** | Every action confirmed in plain English before execution. No exceptions. |
| **Scam Detector** | Urgency language triggers automatic slowdown. Every scam uses urgency. We remove it. |
| **Smart Limits** | User-set ceiling for instant sends. Above it — extra verification. |
| **Closed Signing** | Only Auron contracts can trigger the wallet. No external site can ever fire a transaction. |
| **PIN Protection** | argon2id hashed server-side. Never stored in plaintext. Ever. |
| **Daily Caps** | On-chain ceiling enforced at contract level — not just the client. |

> *"We designed security for people who've never thought about security. That's harder than designing it for experts."*

---

## The Numbers

| | |
|---|---|
| Average transaction time | **4 seconds** |
| Average fee per action | **₹0.02** |
| Seed phrases required | **0** |
| Prompt caching savings | **~90% AI cost reduction** |
| Estimated infra cost at 1,000 users/month | **~$60** |
| Target market | **8,000,000,000 people** |

---

## Revenue Model

Every action generates a fee. Every fee goes directly to Auron. On-chain. Automatic. No intermediaries.

| Action | Fee |
|---|---|
| Send money | 1.5% of amount |
| Save agreement | ₹5 flat |
| Lock savings | 0.5% of amount |
| Prove ownership | ₹2 flat |

```
1,000,000 monthly transactions × ₹0.02 avg fee = ₹20,000/month
         ↑ this scales linearly with zero marginal cost per transaction
```

No subscriptions. No ads. No data selling. Pure transaction revenue — transparent and on-chain.

---

## Competitive Landscape

|  | Traditional Banking | Crypto Wallets | **Auron** |
|---|---|---|---|
| Setup | Days | Seed phrase | **10 seconds** |
| Send money | Slow transfer | Wallet address | **"Send ₹500 to Priya"** |
| Records | Bank can alter | Technical explorer | **Plain English receipt** |
| Security | Bank's rules | Your responsibility | **Built-in, automatic** |
| Target user | Everyone (poorly) | 500M crypto users | **8 billion people** |

**vs. IntentOS** — IntentOS makes DeFi smarter for crypto people. Auron makes blockchain accessible for people who don't know what DeFi is. Different market. 16× larger.

---

## The Demo

When presenting Auron:

1. Open Auron on your phone
2. Say — *"Can I show you something? This takes 60 seconds."*
3. Hand them the phone
4. Say — *"Just type what you want to do with money. Like a text message."*
5. They type. It happens. Receipt appears.
6. Take the phone back.
7. Say — **"You just used a blockchain. For the first time. Without knowing it."**
8. Silence. 3 seconds.
9. Say — *"8 billion people can do that. That's Auron."*

---

## Tech Stack

```
Frontend        Next.js 14 (App Router) + TypeScript
Styling         Tailwind CSS + Framer Motion
Fonts           Playfair Display + DM Sans
Auth            Supabase (Google OAuth + email/password)
Database        Supabase PostgreSQL (users, sessions, transactions, contacts)
Blockchain      Initia — CosmWasm smart contracts
Wallet          @initia/interwovenkit-react
AI Engine       Anthropic Claude API (claude-sonnet-4-6) with prompt caching
Security        argon2id PIN hashing, Vercel KV rate limiting, CSP headers
Mobile          Capacitor — Android APK from the same codebase
Hosting         Vercel
```

---

## Smart Contracts

| Contract | Purpose |
|---|---|
| `transfer.wasm` | Native token transfer with 1.5% treasury fee |
| `agreement.wasm` | Dual-signed immutable agreements / IOUs |
| `timelock.wasm` | Savings vaults with auto-delegation for 12% APY yield |
| `ownership.wasm` | SHA-256 file hash timestamping — permanent ownership proof |

---

## Project Structure

```
auron/
├── frontend/                      # Next.js 14 App Router
│   ├── app/
│   │   ├── page.tsx               # Landing page — 7 sections
│   │   ├── login/page.tsx         # Auth — Google OAuth + email + PIN setup
│   │   ├── app/page.tsx           # Chat interface (authenticated)
│   │   └── api/
│   │       ├── parse-intent/      # Claude AI intent engine
│   │       ├── hash-pin/          # argon2id PIN hashing (server-side)
│   │       └── auth/callback/     # Supabase OAuth callback handler
│   ├── components/
│   │   ├── ChatInterface.tsx      # Main conversational UI
│   │   ├── ConfirmCard.tsx        # 6-layer security confirmation
│   │   ├── RevealCard.tsx         # "What just happened" receipt
│   │   └── VaultPanel.tsx         # Savings vault dashboard
│   └── lib/
│       ├── contracts.ts           # CosmWasm message builders
│       ├── supabase/              # Browser + server Supabase clients
│       └── security.ts            # Intent scanning + rate limiting
├── contracts/
│   ├── transfer/                  # Transfer contract (Rust/CosmWasm)
│   ├── agreement/                 # Agreement contract
│   ├── timelock/                  # Timelock + yield contract
│   └── ownership/                 # Ownership proof contract
└── supabase/
    └── schema.sql                 # Full DB schema + RLS policies
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project
- An [Anthropic](https://console.anthropic.com) API key

### Setup

```bash
# Clone
git clone https://github.com/your-org/auron
cd auron/frontend

# Install dependencies
npm install --legacy-peer-deps

# Configure environment
cp .env.example .env.local
# Add: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, ANTHROPIC_API_KEY

# Run the database schema
# → Supabase Dashboard → SQL Editor → paste supabase/schema.sql → Run

# Start
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Build Android APK

```bash
npm run build
npx cap sync android
# Open Android Studio → Build → Generate Signed APK
```

---

## Why This Wins

**1. Uses every Initia-native feature organically**
Auto-signing, .init usernames, Interwoven Bridge — not bolted on, core to the UX.

**2. Real revenue from day one**
Fees flow directly to treasury on-chain. No token dependency. No theoretical revenue.

**3. The demo is unlike anything else in the room**
Hand a judge your phone. They've used blockchain before you say another word.

**4. The target market is 16× larger**
Every other project targets 500M crypto users. Auron targets 8 billion people.

**5. We prove Initia's thesis**
Initia's pitch is invisible blockchain infrastructure. Auron is the proof of concept.

---

## The Vision

Banks took 500 years to reach where they are.

Blockchain can do everything they do — faster, cheaper, permanent, and without anyone's permission — in 4 seconds.

The only thing missing was an interface that didn't require a computer science degree.

**That's Auron.**

Not a smarter interface for crypto people.
The first interface for everyone else.

---

<div align="center">

**Built on Initia. Powered by Claude. Made for everyone.**

*© 2026 Auron · Your money, your words.*

</div>
