# Auron

**Auron is AI-native financial infrastructure designed for programmable settlement, treasury orchestration, and cross-border money movement.**

It currently settles on Solana. The blockchain is an implementation detail — not the product.

**[Live Demo](https://auron-mocha.vercel.app) · [Pay Link](https://auron-mocha.vercel.app/pay/demo?amount=500&note=Lunch) · [Solana Blink](https://auron-mocha.vercel.app/api/actions/pay?to=demo&amount=500&currency=INR)**

---

## The Problem

Global payments remain fragmented across banking rails, settlement windows, treasury systems, and regional intermediaries. Every transaction crosses multiple coordination boundaries — each introducing latency, opacity, and failure points with no unified view of settlement state.

Modern internet-native systems require programmable, real-time financial coordination capable of handling payment intent creation, settlement verification, treasury state tracking, and cross-border liquidity movement — without relying on legacy banking infrastructure designed for batch processing.

Existing solutions fail because they optimize for a single rail. They are not coordination layers — they are wrappers.

---

## Why Existing Systems Fall Short

| System | Limitation |
|---|---|
| Traditional banking | Batch settlement windows, no programmability, no real-time state |
| Current crypto wallets | Require users to understand blockchain primitives — unusable at scale |
| UPI / domestic rails | Closed systems, no cross-border programmability, no treasury logic |
| Stablecoin apps | Settlement only — no orchestration, no ledger, no lifecycle management |

The gap is not in the rails themselves. The gap is in the coordination layer above them.

---

## Auron Architecture

Auron is structured as a layered financial coordination system, not a monolithic application.

```
┌─────────────────────────────────────────────────────────┐
│                     Client Layer                        │
│        Natural language interface · PWA · Blinks        │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│                   Intent Layer                          │
│   Claude AI parses payment intent → structured action   │
│   Risk scoring · preflight checks · security gates      │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│          Settlement Orchestration Layer                 │
│   Payment intent creation · queue-based execution       │
│   Provider routing · retry logic · fallback handling    │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│           Ledger & Verification Layer                   │
│   Internal transaction ledger · state machine           │
│   On-chain verification · reconciliation workers        │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│               Solana Settlement Rail                    │
│   USDC SPL transfers · Anchor vault program             │
│   Memo stamps · Blinks · on-chain finality              │
└─────────────────────────────────────────────────────────┘
```

Each layer is independently addressable. The settlement rail is replaceable.

---

## Settlement Lifecycle

Every payment in Auron moves through a deterministic state machine:

```
initiated → quoted → signed → verified → settling → completed
                                                   ↘ failed
```

**initiated** — Payment intent created. Amounts, recipient, and provider recorded in ledger.

**quoted** — FX rate locked. USDC equivalent calculated at point-in-time rate.

**signed** — User wallet has signed the on-chain transfer. Signature recorded.

**verified** — On-chain transfer independently confirmed against expected mint, amount, and treasury address. Hard block if verification fails — settlement never proceeds on unverified transactions.

**settling** — Offramp provider called. Settlement record created. Async worker takes ownership.

**completed / failed** — Final state. Immutable. Full audit trail preserved.

This lifecycle is not aspirational — it is live in the current codebase.

---

## Internal Ledger System

Auron maintains an internal transaction ledger independent of blockchain finality to support deterministic transaction tracking, reconciliation, retries, and future multi-rail settlement coordination.

**Three-table schema in Supabase (PostgreSQL):**

```
transactions        — single source of truth for every payment intent
settlements         — one row per settlement attempt, tracks provider payout state
status_history      — append-only audit trail, every transition recorded with timestamp + reason
```

Every status transition writes atomically to both the `transactions` table and `status_history`. Settlement records carry the provider payout ID and UTR number for bank-level reconciliation.

Row-level security is enabled on all tables. All writes go through the service role key on server-side routes — the client never touches the ledger directly.

This architecture mirrors how production fintech systems (Stripe, Razorpay) manage payment state — independent of what the underlying rail reports.

---

## Queue-Based Settlement Orchestration

Settlement execution is handled asynchronously through queue-based orchestration workers, allowing transaction retries, status reconciliation, and non-blocking payment flows.

**Worker routes:**

- `/api/workers/settlement` — claims pending settlements, executes payout calls, updates ledger
- `/api/workers/reconcile` — polls in-flight settlements against provider status, marks completions

**Claim pattern (optimistic locking):**

```
UPDATE settlements
SET status = 'processing'
WHERE status = 'pending'
  AND retry_count < 3
  AND id = $settlementId
```

This prevents double-processing across concurrent worker invocations without requiring distributed locks.

**Retry logic:** exponential backoff (1.5s → 3s → 6s), non-retryable errors (invalid UPI, KYC failures) are immediately terminated — retryable errors (timeouts, network failures) queue for re-attempt.

---

## Solana Settlement Rail

Auron currently uses Solana as the primary high-performance settlement rail due to its sub-second finality and near-zero transaction costs. The architecture is designed for multi-rail expansion.

### Savings Vault — Anchor Program

Custom Anchor program providing time-locked USDC custody. Treasury logic enforced at the program level — not database-enforced.

- **Program ID:** `B5DwqnCoDrY8ezfGaZfpAnvZ4FwCtPNHk6vT5nRgFENg` (devnet)
- **PDA derivation:** `[b"vault", owner_pubkey]` — one vault per user, deterministic address
- **Instructions:** `lock_savings(amount, unlock_timestamp, label)` · `unlock_savings()`
- **USDC custody:** held in ATA owned by the PDA — inaccessible to any party until `clock::unix_timestamp >= unlock_timestamp`

```rust
pub fn lock_savings(ctx, amount: u64, unlock_timestamp: i64, label: String) -> Result<()>
pub fn unlock_savings(ctx) -> Result<()>
```

[View on Solscan (devnet)](https://solscan.io/account/B5DwqnCoDrY8ezfGaZfpAnvZ4FwCtPNHk6vT5nRgFENg?cluster=devnet)

### Agreement Stamps & Ownership Proofs

Immutable timestamped records using the Solana Memo program. Permanently on-chain, verifiable by any party without trusting Auron.

### Solana Blinks

Full implementation of the [Solana Actions spec](https://docs.dialect.to/documentation/solana-actions). Every pay link is simultaneously a human-readable payment page and an interactive Blink operable inside X/Twitter, Dialect, and Phantom.

```
GET  /api/actions/pay  →  action metadata + label
POST /api/actions/pay  →  serialized transaction for wallet signing
```

---

## Transaction Verification

Before any settlement executes, Auron independently verifies the on-chain transfer:

1. Fetches the parsed transaction via Solana RPC
2. Confirms `confirmed` or `finalized` commitment status
3. Checks transaction error field — failed transactions are rejected
4. Scans all instructions — including CPI inner instructions (required for Phantom's routing through the Associated Token Program)
5. Verifies USDC mint address matches expected devnet/mainnet mint
6. Validates transfer amount within 1% tolerance (handles FX rounding)
7. Checks idempotency — already-settled signatures are rejected

Verification is a hard gate. Settlement never proceeds on a transaction that fails this check. No exceptions.

---

## Intent Layer

Auron abstracts payment execution behind a natural language coordination interface. Users express intent in plain language — the system resolves it into a structured, verifiable payment action.

```
"send ₹500 to Priya"
→ { action: "upi_payment", inr_amount: 500, recipient: "priya@upi", usdc_amount: 5.98 }

"lock ₹2000 for 3 months"
→ { action: "lock_savings", usdc_amount: 23.91, duration_days: 90, label: "savings" }

"scan and pay"
→ QR scan → UPI payment intent → settlement flow
```

**6-layer security gates run before every execution:**

1. **Intent mirror** — Explicit confirmation of what will execute
2. **Scam detector** — Urgency language triggers mandatory slowdown
3. **Spend ceiling** — User-defined per-transaction limit
4. **Closed signing** — Wallet signing only via Auron-originated requests
5. **Daily cap** — Hard ceiling, bounded exposure window
6. **Risk scoring** — New recipients, unusual amounts, high frequency all flagged

---

## Developer Experience

**Local setup:**

```bash
cd frontend
npm install
cp .env.example .env.local
# Required: ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
# Optional: ONMETA_API_KEY (omit for demo mode), SOLANA_RPC_URL
npm run dev
```

**Database setup (Supabase SQL Editor):**

```bash
# Run frontend/lib/db/schema.sql in your Supabase project
# Creates: transactions, settlements, status_history, users, kyc_submissions, contacts, intent_log
```

**Deploy Anchor program (devnet):**

```bash
# Requires WSL + Solana CLI + Anchor 0.32.1 + devnet SOL
# Faucet: https://faucet.solana.com
bash deploy.sh
```

**Environment flags:**

```
DEMO_SETTLEMENT=true    — simulated payout, real TX verification still runs
NEXT_PUBLIC_SOLANA_NETWORK=devnet | mainnet-beta
```

---

## Roadmap

**Phase 1 — Settlement Infrastructure (current)**
- Programmable payment intent layer
- Internal ledger with full lifecycle management
- On-chain verification engine
- Queue-based settlement orchestration
- Time-locked treasury vault (Anchor program)

**Phase 2 — Treasury Primitives**
- Merchant settlement APIs
- Programmable payment splits and escrow
- Agent-authorized recurring settlement
- Compliance and reconciliation tooling
- Expanded liquidity provider routing

**Phase 3 — Sovereign Financial Infrastructure**
- Multi-rail settlement support (SWIFT, Stellar, Lightning)
- Institutional treasury APIs
- Intelligent liquidity routing
- Cross-border settlement coordination
- Autonomous treasury orchestration agents

---

## Why Now

The convergence of stablecoin adoption, programmable settlement infrastructure, and AI systems capable of executing financial intent creates a narrow window for a new coordination layer to establish itself between legacy banking rails and the next generation of internet-native financial systems.

India's UPI infrastructure — 350 million users, ₹20 trillion monthly volume — represents the most active real-time payment network in the world. It has no programmable layer. No treasury primitives. No cross-border coordination.

Auron is building that layer.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 App Router, TypeScript |
| Intent Engine | Claude Sonnet (structured intent parsing, prompt caching) |
| Spending Intelligence | Claude Haiku (on-chain analytics, conversational) |
| Settlement Rail | Solana — USDC SPL transfers, Anchor vault program |
| Ledger | Supabase (PostgreSQL) — transactions, settlements, audit trail |
| Auth | Supabase — Google OAuth + phone OTP |
| Wallet | Phantom — desktop + mobile deep link protocol |
| Rate Limiting | Vercel KV |
| Security | argon2id PIN hashing, CSP headers, RLS on all DB tables |
| Distribution | Solana Blinks, shareable pay links, PWA (Android) |

---

*Auron is a programmable financial system that currently settles on Solana.*
