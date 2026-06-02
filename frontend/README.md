# Auron

**Programmable stablecoin settlement infrastructure for India.**

User pays in USDC. Merchant receives INR to their UPI account. Under 30 seconds. The blockchain is invisible.

**Live demo → [auron-mocha.vercel.app](https://auron-mocha.vercel.app)**  
**Settlement stats → [auron-mocha.vercel.app/stats](https://auron-mocha.vercel.app/stats)**  
**Blinks preview → [auron-mocha.vercel.app/blink](https://auron-mocha.vercel.app/blink)**

---

## What Auron Does

India's UPI network processes ₹240 trillion per year — the most active payment network on earth. There is no programmable settlement layer above it.

Auron is that layer.

A merchant accepts USDC from anywhere in the world. Auron verifies the USDC transfer on Solana, routes it through the settlement engine, and the merchant receives rupees directly to their existing UPI account — no new wallet, no crypto knowledge, no friction.

The user interacts with a natural language interface. The merchant receives rupees. The blockchain is invisible to both.

---

## Architecture

### Layer 1 — On-Chain Verification
Every payment passes a **7-step verification on Solana RPC** before settlement executes:
- Commitment status confirmed
- Mint address matches USDC
- No CPI inner instructions (exploit prevention)
- Amount within tolerance
- Idempotency key validated
- Recipient is the Auron treasury
- Transaction finalized

No unverified payment ever reaches a merchant.

### Layer 2 — Settlement State Machine
Every payment moves through a **7-state lifecycle**:

```
initiated → quoted → signed → verified → settling → completed
                                                   ↘ failed
```

Every state transition is atomic and persisted to an append-only financial ledger. Full audit trail on every payment.

### Layer 3 — Settlement Execution
- **Async workers** with optimistic locking — prevents double-processing across concurrent invocations
- **Reconciliation engine** — automatically recovers stuck settlements
- **Multi-provider routing** — scores OnMeta and Razorpay by fee and speed on every payment
- **Retry logic** — up to 3 attempts with exponential backoff before marking failed

---

## What Is Live

| Component | Status |
|---|---|
| Claude AI intent parsing + prompt caching | ✅ Live |
| FX quote engine — live CoinGecko rate, 0.85% spread | ✅ Live |
| 7-state settlement state machine | ✅ Live |
| Append-only financial ledger (Supabase) | ✅ Live |
| Async settlement workers + reconciliation engine | ✅ Live |
| Multi-provider routing: OnMeta + Razorpay | ✅ Live |
| 7-step on-chain USDC verification | ✅ Live |
| Solana Blinks — composable pay links | ✅ Live |
| PWA — installable, mobile-first | ✅ Live |
| Public settlement stats page | ✅ Live |
| Anchor vault program (time-locked USDC) | ✅ Devnet |
| Real NPCI UTR payout | ⏳ Pending KYB |

---

## AI Layer — Claude Integration

Auron uses **Claude claude-sonnet-4-6** as the intent parsing layer with production-grade prompt caching.

Users type plain English:
- `"Pay ₹450 to Swiggy"` → `upi_payment` action
- `"Send ₹500 to priya.sol"` → `transfer_usdc` action
- `"Lock ₹2000 for 3 months"` → `lock_savings` action
- `"How much did I spend this week?"` → `spending_query` action
- `"Create a pay link for ₹500"` → `generate_pay_link` action

**Prompt caching reduces cost by 90%** — system prompt is cached, only the user message is billed per request.

The streaming SSE response renders text character-by-character while Claude parses intent in parallel. Zero perceptible latency.

```
app/api/chat/route.ts     — Streaming Claude integration + SSE
lib/claude.ts             — Intent parsing schema + prompt caching
app/api/parse-intent/     — Rate-limited intent endpoint (Vercel KV)
```

---

## Solana Blinks

Every Auron pay link is a composable on-chain action. Paste it into X, Phantom, or Dialect — it renders as an interactive payment card without any redirect.

```
GET  /api/actions/pay     — Blinks metadata (Solana Actions spec)
POST /api/actions/pay     — Initiates payment from Blink
/.well-known/solana-pay  — Blinks registry validation
/actions.json            — Actions manifest
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Blockchain | Solana (devnet) |
| Smart contracts | Anchor (Rust) |
| Stablecoin | USDC (SPL Token) |
| AI | Claude claude-sonnet-4-6 (Anthropic) |
| Database | Supabase (PostgreSQL) |
| Settlement | OnMeta + Razorpay X |
| State | Zustand |
| Animations | Framer Motion |
| Rate limiting | Vercel KV |
| Monitoring | Sentry |
| Deployment | Vercel |

---

## Project Structure

```
frontend/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── api/
│   │   ├── chat/route.ts           # Streaming Claude intent layer
│   │   ├── v1/pay/route.ts         # Main payment endpoint
│   │   ├── v1/payment/[id]/        # Payment status + receipt
│   │   ├── quote/route.ts          # FX quote engine
│   │   ├── rate/route.ts           # Live CoinGecko FX rate
│   │   ├── actions/pay/            # Solana Blinks endpoint
│   │   ├── workers/settlement/     # Async settlement worker (cron)
│   │   ├── offramp/route.ts        # OnMeta integration
│   │   └── razorpay/route.ts       # Razorpay X integration
│   ├── stats/                      # Public settlement dashboard
│   ├── blink/                      # Blinks preview page
│   └── app/                        # Main chat interface
├── components/
│   ├── ChatInterface.tsx            # AI chat + payment flow
│   ├── ConfirmCard.tsx              # 6-layer security confirmation
│   ├── RevealCard.tsx               # Payment success screen
│   ├── PaymentStatusTracker.tsx     # Live settlement tracker
│   └── QRScanner.tsx                # UPI QR code scanner
├── lib/
│   ├── claude.ts                   # Claude intent parsing
│   ├── quote.ts                    # FX quote engine
│   ├── razorpay.ts                 # Razorpay X payout integration
│   ├── onmeta.ts                   # OnMeta offramp integration
│   ├── db/ledger.ts                # Financial ledger operations
│   ├── security.ts                 # Urgency detection + spend limits
│   ├── routing.ts                  # Multi-provider routing
│   ├── risk.ts                     # Risk assessment engine
│   └── solana.ts                   # Solana RPC helpers
└── programs/                       # Anchor smart contracts
    └── auron-vault/                # Time-locked USDC vault
```

---

## Security

Six layers run on every transaction before execution:

1. **Rate limiting** — Vercel KV distributed rate limiting (12 req/60s)
2. **Intent verification** — Claude confidence threshold (0.8 minimum)
3. **Urgency detection** — Scam prevention via keyword analysis
4. **Smart limits** — User-defined spend ceiling with hold duration
5. **On-chain verification** — 7-step Solana RPC hard gate
6. **Risk assessment** — Amount, frequency, and recipient scoring

---

## Local Development

### Prerequisites
- Node.js 18+
- Phantom wallet (devnet)
- Solana CLI (for contract deployment)

### Setup

```bash
# Clone and install
git clone <repo>
cd frontend
npm install

# Environment variables
cp .env.example .env.local
# Fill in: ANTHROPIC_API_KEY, NEXT_PUBLIC_SOLANA_RPC_URL,
#          SUPABASE_URL, SUPABASE_ANON_KEY,
#          RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET,
#          NEXT_PUBLIC_FEE_WALLET

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Yes | Solana RPC endpoint |
| `NEXT_PUBLIC_FEE_WALLET` | Yes | Auron treasury wallet address |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `RAZORPAY_KEY_ID` | Yes | Razorpay API key |
| `RAZORPAY_KEY_SECRET` | Yes | Razorpay API secret |
| `RAZORPAY_ACCOUNT_ID` | No | Razorpay X account (activates real payouts) |
| `ONMETA_API_KEY` | No | OnMeta API key (activates OnMeta route) |
| `FALLBACK_FX_RATE_INR` | No | Fallback rate if CoinGecko is down |
| `CRON_SECRET` | No | Protects settlement worker endpoint |
| `KV_REST_API_URL` | No | Vercel KV (rate limiting) |

### Key Commands

```bash
npm run dev          # Development server
npm run build        # Production build
npm run type-check   # TypeScript validation
npm run lint         # ESLint
```

---

## Settlement Flow

```
User types intent
      ↓
Claude parses → structured action JSON
      ↓
FX quote fetched (CoinGecko live rate + 0.85% spread, 60s lock)
      ↓
User signs USDC transfer in Phantom
      ↓
Solana transaction submitted
      ↓
7-step on-chain verification (Solana RPC)
      ↓
Payment record created in ledger
      ↓
Settlement worker claims payment (optimistic lock)
      ↓
Provider selected (OnMeta or Razorpay X)
      ↓
INR payout dispatched to merchant UPI
      ↓
UTR received → payment marked completed
      ↓
Receipt generated (SHA-256 hash)
```

---

## Roadmap

**Production (this grant):**
- Business entity registration
- KYB onboarding — Razorpay X + OnMeta → first real NPCI UTR
- Anchor vault mainnet deployment + security review
- Public TypeScript SDK
- 3 merchant pilot integrations

**Phase 2:**
- Enterprise settlement APIs
- Multi-corridor expansion (beyond India)
- AI agent payment rails
- Programmable treasury flows

---

## Built By

**Anirudh Vashisth** — India-based builder, 1.5 years on Solana.

Every component in this repository — the settlement engine, state machine, reconciliation workers, Anchor vault, AI intent layer, Solana Blinks integration — was built from India, because this infrastructure needs to exist.

[auron-mocha.vercel.app](https://auron-mocha.vercel.app) · [X @anirudhh](https://x.com/anirudhh)

---

*Auron — The missing programmable settlement layer above UPI.*
