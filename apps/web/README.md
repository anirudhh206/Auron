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

The user interacts with a natural language interface powered by Claude AI. The merchant receives rupees. The blockchain is invisible to both.

---

## Architecture

### Layer 1 — On-Chain Verification
Every payment passes a **7-step verification on Solana RPC** before any settlement executes:
- Commitment status confirmed
- Mint address matches USDC
- No CPI inner instructions (exploit prevention)
- Amount within tolerance
- Idempotency key validated
- Recipient is the Auron treasury wallet
- Transaction finalized

No unverified payment ever reaches a merchant. This is a hard gate — not a soft check.

### Layer 2 — Settlement State Machine
Every payment moves through a **7-state lifecycle**:

```
initiated → quoted → signed → verified → settling → completed
                                                   ↘ failed
```

Every state transition is atomic and persisted to an append-only financial ledger. Full audit trail on every payment. Every step is recoverable.

### Layer 3 — Settlement Execution
- **Async workers** with optimistic locking — prevents double-processing across concurrent invocations
- **Reconciliation engine** — automatically detects and recovers stuck settlements
- **OnMeta primary** — USDC → INR conversion + UPI payout in one step (Phase 1)
- **Retry logic** — up to 3 attempts before marking failed permanently
- **Refund path** — if payout fails after USDC confirmed, user gets USDC back

### Protocol Treasury
Every completed payment leaves **0.85% spread** in the treasury wallet on Solana as USDC. The treasury fills itself automatically — no manual funding, no bank account, no pre-loaded fiat.

```
User pays 5.402 USDC
        ↓
OnMeta uses 5.35 USDC → ₹450 to merchant UPI
        ↓
0.052 USDC (0.85%) stays in treasury wallet
```

Treasury balance is publicly visible on the stats page and verifiable on Solscan.

---

## What Is Live

| Component | Status |
|---|---|
| Claude AI intent parsing + prompt caching | ✅ Live |
| FX quote engine — live CoinGecko rate, 0.85% spread | ✅ Live |
| 7-state settlement state machine | ✅ Live |
| Append-only financial ledger (Supabase) | ✅ Live |
| Async settlement workers + reconciliation engine | ✅ Live |
| OnMeta offramp — USDC→INR→UPI | ✅ Live (demo mode) |
| 7-step on-chain USDC verification | ✅ Live |
| Solana Blinks — composable pay links | ✅ Live |
| PWA — installable, mobile-first | ✅ Live |
| Public settlement stats page + treasury tracker | ✅ Live |
| UPI QR scanner | ✅ Live |
| 6-layer security system | ✅ Live |
| Phantom + mobile deep link support | ✅ Live |
| Anchor vault program (time-locked USDC) | ✅ Devnet |
| Real NPCI UTR payout | ⏳ Pending KYB (Milestone 2) |

---

## Settlement Flow

```
User types intent in plain English
        ↓
Claude AI parses → structured action JSON (confidence ≥ 0.8)
        ↓
FX quote fetched — live CoinGecko rate, 0.85% spread, 60s lock
        ↓
User signs USDC transfer in Phantom
        ↓
Solana transaction submitted
        ↓
7-step on-chain verification (Solana RPC hard gate)
        ↓
Payment record created in ledger (initiated → verified)
        ↓
Settlement dispatched to OnMeta
        ↓
OnMeta: USDC → INR → merchant UPI (real-time conversion)
        ↓
0.85% spread stays in treasury wallet as USDC
        ↓
UTR received → payment marked completed
        ↓
Receipt generated (SHA-256 hash, publicly verifiable)
```

---

## AI Layer — Claude Integration

Auron uses **Claude claude-sonnet-4-6** as the intent parsing layer with production-grade prompt caching.

Users type plain English — Claude converts it to structured payment actions:

| Input | Action | Result |
|---|---|---|
| `"Pay ₹450 to Swiggy"` | `upi_payment` | USDC → INR → Swiggy UPI |
| `"Send ₹500 to priya.sol"` | `transfer_usdc` | USDC to resolved wallet |
| `"Lock ₹2000 for 3 months"` | `lock_savings` | Anchor vault time-lock |
| `"How much did I spend this week?"` | `spending_query` | Ledger analytics answer |
| `"Create a pay link for ₹500"` | `generate_pay_link` | Shareable Blinks URL |

**Prompt caching reduces AI cost by 90%** — system prompt cached, only user message billed per request. Streaming SSE renders response character-by-character with zero perceptible latency.

```
app/api/chat/route.ts     — Streaming Claude integration + SSE
lib/claude.ts             — Intent parsing schema + prompt caching
app/api/parse-intent/     — Rate-limited intent endpoint (Vercel KV)
```

---

## Routing Architecture

Auron uses two clearly separated settlement paths — not interchangeable:

**PATH A — OnMeta (primary, Phase 1)**
```
USDC → OnMeta API → INR conversion → merchant UPI
```
OnMeta handles the full USDC→INR conversion and UPI payout in one step. No pre-funded fiat pool needed. Requires OnMeta KYB.

**PATH B — Multi-provider (Phase 2, post-grant)**
```
OnMeta fails → route to Provider 2 (Transak / ZeroHash) → merchant UPI
```
Secondary provider acts as instant fallback. Treasury USDC used for real-time conversion via Provider 2. No manual intervention. Provider 2 holds the liquidity — not Auron.

> **Razorpay X** is integrated for contact and fund account creation (real API calls visible in dashboard). Payout dispatch requires Razorpay X KYB (`RAZORPAY_ACCOUNT_ID`) — Milestone 2 of the grant.

---

## Solana Blinks

Every Auron pay link is a composable on-chain action. Paste it into X, Phantom, or Dialect — it renders as an interactive payment card without any redirect.

```
GET  /api/actions/pay      — Blinks metadata (Solana Actions spec)
POST /api/actions/pay      — Initiates payment from Blink
/.well-known/solana-pay   — Blinks registry validation
/actions.json             — Actions manifest
/blink                    — Live Blinks preview page
```

---

## Security

Six layers run on every transaction before execution:

1. **Rate limiting** — Vercel KV distributed rate limiting (12 req/60s per user)
2. **Intent verification** — Claude confidence threshold (0.8 minimum — ambiguous intents rejected)
3. **Urgency detection** — Scam prevention via keyword analysis with automatic slowdown
4. **Smart limits** — User-defined spend ceiling with configurable hold duration
5. **On-chain verification** — 7-step Solana RPC hard gate (no unverified USDC dispatched)
6. **Risk assessment** — Amount, frequency, recipient, and daily spend scoring

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Blockchain | Solana (devnet → mainnet via grant) |
| Smart contracts | Anchor (Rust) |
| Stablecoin | USDC (SPL Token) |
| AI | Claude claude-sonnet-4-6 (Anthropic) |
| Database | Supabase (PostgreSQL) |
| Primary offramp | OnMeta (USDC→INR→UPI) |
| Secondary offramp | Razorpay X (Phase 2) |
| State management | Zustand |
| Animations | Framer Motion |
| Rate limiting | Vercel KV |
| Monitoring | Sentry |
| Deployment | Vercel |

---

## Project Structure

```
frontend/
├── app/
│   ├── page.tsx                       # Landing page (with InfraSection)
│   ├── api/
│   │   ├── chat/route.ts              # Streaming Claude intent layer (SSE)
│   │   ├── v1/pay/route.ts            # Main payment endpoint (OnMeta primary)
│   │   ├── v1/payment/[id]/           # Payment status + receipt polling
│   │   ├── quote/route.ts             # FX quote engine (live rate + spread)
│   │   ├── rate/route.ts              # Live CoinGecko FX rate (60s cache)
│   │   ├── stats/route.ts             # Public stats + treasury tracker
│   │   ├── actions/pay/               # Solana Blinks endpoint
│   │   ├── workers/settlement/        # Async settlement worker (Vercel Cron)
│   │   ├── offramp/route.ts           # OnMeta integration
│   │   └── razorpay/route.ts          # Razorpay X contact + fund account
│   ├── stats/                         # Public settlement dashboard
│   ├── blink/                         # Blinks preview page
│   └── app/                           # Main chat interface (PWA)
├── components/
│   ├── ChatInterface.tsx              # AI chat + full payment pipeline
│   ├── ConfirmCard.tsx                # 6-layer security confirmation
│   ├── RevealCard.tsx                 # Payment success screen
│   ├── PaymentStatusTracker.tsx       # Live settlement lifecycle tracker
│   └── QRScanner.tsx                  # UPI QR code scanner
├── lib/
│   ├── claude.ts                      # Claude intent parsing + prompt caching
│   ├── quote.ts                       # FX quote engine
│   ├── routing.ts                     # Settlement path selection (PATH A/B)
│   ├── treasury.ts                    # Protocol revenue tracker (USDC balance)
│   ├── onmeta.ts                      # OnMeta offramp integration
│   ├── razorpay.ts                    # Razorpay X payout integration
│   ├── db/ledger.ts                   # Financial ledger (all DB operations)
│   ├── security.ts                    # Urgency detection + spend limits
│   ├── risk.ts                        # Risk assessment engine
│   ├── verify-tx.ts                   # 7-step Solana transaction verification
│   ├── payment-state.ts               # Payment record + lifecycle types
│   └── solana.ts                      # Solana RPC helpers
└── programs/
    └── auron-vault/                   # Anchor: time-locked USDC vault
```

---

## Local Development

### Prerequisites
- Node.js 18+
- Phantom wallet (set to devnet)
- Solana CLI (for contract deployment)

### Setup

```bash
git clone <repo>
cd frontend
npm install

cp .env.example .env.local
# Fill required vars (see table below)

npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Yes | Solana RPC endpoint (Helius recommended) |
| `NEXT_PUBLIC_SOLANA_NETWORK` | Yes | `devnet` or `mainnet-beta` |
| `NEXT_PUBLIC_FEE_WALLET` | Yes | Treasury wallet address (receives 0.85% spread) |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server only) |
| `RAZORPAY_KEY_ID` | Yes | Razorpay API key |
| `RAZORPAY_KEY_SECRET` | Yes | Razorpay API secret |
| `RAZORPAY_ACCOUNT_ID` | No | Razorpay X account number (activates real INR payouts) |
| `ONMETA_API_KEY` | No | OnMeta API key (activates real offramp) |
| `FALLBACK_FX_RATE_INR` | No | Fallback FX rate if CoinGecko is down (default: 84.00) |
| `CRON_SECRET` | No | Protects settlement worker cron endpoint |
| `KV_REST_API_URL` | No | Vercel KV URL (rate limiting) |
| `KV_REST_API_TOKEN` | No | Vercel KV token |
| `CLAUDE_SYSTEM_PROMPT` | No | Override system prompt (stored in env, never in code) |

### Commands

```bash
npm run dev          # Development server
npm run build        # Production build
npm run type-check   # TypeScript (zero errors required)
npm run lint         # ESLint
```

---

## Roadmap

### Phase 0 — Built ✅
Full settlement pipeline, Claude AI intent layer, 7-step on-chain verification, 7-state machine, financial ledger, async workers, reconciliation engine, Solana Blinks, PWA, UPI QR scanner, public stats page, treasury tracker, 6-layer security.

### Phase 1 — Grant Milestones ($10,000)

| # | Milestone | Budget | Unlocks |
|---|---|---|---|
| 1 | Business entity registration | $1,500 | Legal entity — prerequisite for all KYB |
| 2 | KYB — Razorpay X + OnMeta | $2,000 | **First real NPCI UTR** — production payouts |
| 3 | Anchor vault mainnet + security review | $2,500 | Time-locked USDC on mainnet |
| 4 | Public API docs + TypeScript SDK | $2,000 | Developers can build on Auron |
| 5 | Production infra + 3 merchant pilots | $2,000 | Real merchant onboarding |

### Phase 2 — Post-Grant
- Multi-provider routing: Transak / ZeroHash as Provider 2 (instant OnMeta fallback)
- Treasury USDC used for secondary offramp when OnMeta fails
- Rolling float: 1-3 days of transaction volume (Rain model)
- SMS / WhatsApp notifications
- Recurring payments + bill split
- Contact book + spending dashboard
- Enterprise settlement APIs + webhooks
- Self-serve merchant onboarding

### Phase 3 — Scale
- Multi-corridor: SEA, LATAM, Africa (any stablecoin → any local currency → any rail)
- AI agent payment rails — autonomous settlement, pay APIs, invoke invoices
- USDT, EUROC, PYUSD support
- Protocol revenue sharing with stakers
- Token + governance (Phase 3 only — never Phase 1 or 2)
- White-label infrastructure for fintechs and banks

---

## Built By

**Anirudh Vashisth** — India-based builder, 1.5 years on Solana.

Every component in this repository — the settlement engine, state machine, reconciliation workers, Anchor vault, AI intent layer, Solana Blinks integration, protocol treasury — was built from India, because this infrastructure needs to exist.

India processes more digital payments than any country on earth. None of it is programmable. Auron is the layer that changes that.

[auron-mocha.vercel.app](https://auron-mocha.vercel.app) · [X @anirudhh](https://x.com/anirudhh)

---

*Auron — The missing programmable settlement layer above UPI.*
