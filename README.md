# Auron

**Programmable financial operating infrastructure for the stablecoin internet.**

Auron is the coordination layer between payment intent and settlement execution — the infrastructure primitive that lets users, merchants, businesses, and AI systems move value globally using stablecoins, without touching traditional banking rails.

The blockchain is an implementation detail. The product is the infrastructure.

**[Live Demo](https://auron-mocha.vercel.app) · [Pay Link](https://auron-mocha.vercel.app/pay/demo?amount=500&note=Lunch) · [Solana Blink](https://auron-mocha.vercel.app/api/actions/pay?to=demo&amount=500&currency=INR)**

---

## The Thesis

Stablecoins are becoming the settlement layer for the internet.

But moving stablecoin value into the real economy — into local currencies, merchant accounts, payroll systems, treasury workflows — requires infrastructure that doesn't exist yet as an open, composable, programmable layer.

Traditional banking infrastructure settles slowly, fragments across geographies, depends on intermediaries, and is fundamentally incompatible with programmable financial logic. It cannot be integrated with AI systems. It cannot route conditionally. It cannot recover from failures automatically.

Auron replaces that coordination layer with:

- **Verified settlement** — on-chain proof before any payout executes
- **Programmable routing** — intelligent provider selection, fallback, and recovery
- **State-tracked lifecycles** — every payment through a deterministic, auditable state machine
- **AI-native primitives** — financial actions that machines can read, execute, and compose

The long-term goal is not to become another crypto payment app.

The goal is to become **the programmable financial infrastructure layer that powers stablecoin movement between users, merchants, businesses, and AI systems globally.**

---

## What's Live Today

Every component below is in production code, not roadmap:

| Component | Status | What it does |
|---|---|---|
| Payment intent layer | ✅ Live | Natural language → structured payment action via Claude AI |
| FX quote engine | ✅ Live | Live CoinGecko rate, 0.85% spread, 60s locked quote with slippage guard |
| On-chain verification | ✅ Live | 7-step USDC transfer verification — hard gate before any settlement |
| Internal ledger | ✅ Live | Postgres-backed transaction + settlement + append-only audit trail |
| Settlement state machine | ✅ Live | 9-state lifecycle with atomic, immutable transitions |
| Failure & recovery system | ✅ Live | Auto-classification, provider switching, exponential backoff, auto-refund |
| Async settlement workers | ✅ Live | Queue-based execution with optimistic locking and reconciliation |
| Multi-provider routing | ✅ Live | OnMeta (primary) + Razorpay (fallback), scored routing engine |
| Liquidity model | ✅ Live | Treasury tracking, in-flight USDC, pre-payment gates, reserve alerts |
| Refund engine | ✅ Live | Automatic USDC return on terminal failures — on-chain, verifiable |
| Receipt system | ✅ Live | SHA-256 canonical receipts with on-chain hash + full audit trail |
| Anchor vault program | ✅ Devnet | Time-locked USDC custody, PDA-based, program-enforced |
| Solana Blinks | ✅ Live | Every pay link is a natively composable on-chain action |
| KYC system | ✅ Live | Middleware-gated, Supabase-tracked, provider-agnostic |
| 6-layer security | ✅ Live | Risk scoring, spend ceiling, scam detection, closed signing |

---

## The Infrastructure Gap

India's UPI network processes ₹20 trillion per month across 350 million users. It is the most active real-time payment system on earth.

Stablecoins already settle trillions of dollars in annual volume globally.

Between them: nothing. No programmable settlement layer. No treasury primitives. No cross-border coordination logic. No lifecycle management above the transaction level.

Every attempt to bridge them produces the same result: a wrapper around a single rail that breaks at the coordination boundary.

The gap is not in the rails. It is in the layer above them — the layer that manages state, routes between providers, verifies on-chain, tracks settlement, and recovers from failure automatically.

**That layer is Auron.**

---

## Architecture

```
User (natural language intent)
        ↓
  Intent Layer — Claude AI parses intent → structured action
        ↓
  Quote Engine — live FX rate, 0.85% spread, 60s locked quote
        ↓
  Preflight — risk score, spend ceiling, scam detection, liquidity gate
        ↓
  Wallet Signing — Phantom (desktop + mobile deep link)
        ↓
  On-Chain Verification — 7-step Solana RPC check (HARD GATE)
        ↓
  Internal Ledger — Postgres: transactions + settlements + status_history
        ↓
  Routing Engine — scored provider selection (fee 60%, speed 40%)
        ↓
    ┌─────────────────────────────────┐
    │  OnMeta (primary)               │  USDC → INR → UPI
    │  Razorpay X (fallback)          │  INR float → UPI
    │  Manual (last resort)           │  operator queue
    └─────────────────────────────────┘
        ↓
  Settlement Worker — async, optimistic lock, retry + recovery
        ↓
  Reconciliation Worker — detects stuck payments, fixes mismatches
        ↓
  Merchant receives INR via UPI
```

---

## Settlement Lifecycle

Every payment moves through a deterministic, persisted state machine. No payment skips a state. No settlement fires on an unverified transaction.

```
[initiated]
    ↓  FX rate locked
[quoted]
    ↓  User signs on-chain transfer
[signed]
    ↓  Server confirms on-chain transfer (7-step hard gate)
[verified]
    ↓  Settlement record created, provider selected
[settling]
    ↓  Provider confirms payout
[completed]  ← terminal ✓

[verified/settling] → [failed]       ← terminal ✗  (triggers auto-refund if eligible)
[failed]            → [refund_pending] → [refunded]  ← terminal ✓
```

Every transition is:
- **Atomic** — both `transactions` and `status_history` update in the same operation
- **Immutable** — history rows are never updated or deleted
- **Recoverable** — failure classification determines retry, provider switch, or auto-refund automatically

---

## Failure System

When a settlement fails, the failure system answers three questions automatically:

1. **What category is this?** — 14 pattern-matched failure categories (invalid UPI, timeout, rate limit, 5xx, FX expiry, slippage, etc.)
2. **Can we recover?** — retry with backoff, switch to fallback provider, queue for manual review
3. **Should we refund?** — auto-triggers USDC return to user's wallet on terminal failures

```
Provider failure
    ↓
classifyFailure(error) → category + severity + retryable + switchProvider + autoRefund
    ↓
decideRecovery(classification, retryCount, provider)
    ↓
  "retry"          → exponential backoff (5s → 15s → 45s)
  "switch_provider"→ OnMeta → Razorpay → Manual
  "refund"         → executeRefund() → USDC back on-chain → receipted
  "manual_review"  → flagged for ops team
```

Additional guards:
- **Price guard** — if FX rate moves >150bps between quote and settlement, auto-refund
- **Quote expiry** — server-side TTL check before every settlement attempt
- **Stuck payment detector** — `processing` >10min reset, `settling` >30min flagged

---

## Liquidity Model

```
treasury_balance (on-chain USDC)
    - in_flight_usdc  (pending + settling payments)
    = available_usdc

Pre-payment gate checks:
  ✓ amount >= 0.5 USDC (minimum)
  ✓ amount <= 5,000 USDC (per-transaction cap)
  ✓ treasury_balance >= MIN_RESERVE (50 USDC) + amount
  ✓ in_flight + amount <= MAX_IN_FLIGHT (10,000 USDC)
```

Reserve alerts fire at 2x minimum. Critical alert at 1x minimum. Both logged and surfaced via `/api/stats`.

---

## End-to-End Payment Flow

Every payment follows the same deterministic 10-phase pipeline. Understanding it is essential for integrating with Auron or debugging issues.

### Phase 0 — Authentication
User authenticates via **Google OAuth or phone OTP** (Supabase Auth). Middleware checks session cookie on every request — unauthenticated users bounce to `/login`.

### Phase 1 — Wallet Connection
**Desktop:** Phantom wallet adapter popup.  
**Mobile:** Phantom deep link (opens Phantom app, authenticates, redirects back with pubkey in URL).  
Result: Solana public key + `sendTransaction` function.

### Phase 2 — Onboarding (first-time only)
User sets:
- **Spend ceiling** (e.g., ₹5,000 max per tx)
- **PIN** → sent to `/api/hash-pin` → **server-side argon2id hashing** → stored in Zustand, never in plaintext

### Phase 3 — Payment Intent

**Natural language path:**
1. User types "Pay ₹450 to Swiggy QR"
2. Text → `POST /api/parse-intent` (rate-limited via Vercel KV)
3. Claude Sonnet parses into: `{ action: "upi_payment", inr_amount: 450, merchant_upi_id: "..." }`
4. `assessRisk()` scores the action 0–100
5. `chooseProvider()` selects settlement path (onmeta or treasury_razorpay)
6. `runPreflightChecks()` verifies USDC balance, SOL fee balance, network

**QR scan path:**
1. User taps QR button → `QRScanner` opens camera
2. `@zxing/browser` decodes QR → parsed into UPI intent string
3. Amount entry modal → **bypasses Claude entirely**, goes directly to ConfirmCard

### Phase 4 — Quote

`/api/quote` fetches live rate from CoinGecko, applies **0.85% spread**, returns:
```json
{ "usdcAmount": 5.41, "fxRate": 83.18, "expiresAt": "T+60s" }
```

### Phase 5 — 6-Layer Security Check + ConfirmCard

Before user can confirm, the **security system** runs:

| Layer | What it does |
|---|---|
| Intent Mirror | User sees exact action in plain English |
| Scam Detector | Urgency keywords detected → 60s mandatory cooldown |
| Spend Ceiling | Amount > ceiling → requires hold-to-confirm (press + hold button) |
| Risk Scoring | Score displayed; hard block if > 70 |
| Closed Signing | Only Auron triggers wallet prompt (prevents fake requests) |
| Daily Cap | Server enforces daily spend limit |

### Phase 6 — Solana Transaction (Client-Side)

User clicks Confirm → **Phantom signs and broadcasts:**

- **UPI payment** → `buildUPIPayment()` → SPL token transfer of X USDC from user wallet → Auron treasury (`NEXT_PUBLIC_FEE_WALLET`)
- **SOL transfer** → `buildTransferSOL()`
- **USDC transfer** → `buildTransferUSDC()`
- **Savings lock** → `buildSavingsLock()` → calls Anchor vault program
- **Agreement stamp** → `buildAgreementStamp()` → Solana memo program
- **Ownership proof** → `buildOwnershipStamp()` → SHA-256 hash on-chain

Returns **Solana transaction signature** (e.g., `5KtPxQ...wR2`).

### Phase 7 — Settlement Pipeline (Server)

Client POSTs to `/api/v1/pay` with signature + payment details. **8-step server pipeline:**

```
1. Validate request body
   (paymentId, merchantUpiId, inrAmount, usdcAmount, txSignature, userId)

2. Idempotency check
   If idempotencyKey already completed → return cached response immediately

3. Replay protection
   If txSignature already settled → return 409 Conflict

4. ⚡ LIQUIDITY GATE (NEW)
   checkLiquidityGate(usdcAmount):
   • Treasury must hold MIN_RESERVE (50 USDC) + payment amount
   • Total in-flight must not exceed 10,000 USDC
   Fail → 503, no ledger record created

5. Create ledger record
   Supabase: transactions table
   State: initiated → quoted → signed

6. 7-step on-chain verification (HARD GATE)
   verifyUsdcTransfer() against Solana RPC:
   ✓ Fetch parsed tx (4 retries × 3s)
   ✓ Confirmed or finalized commitment
   ✓ No tx.meta.err
   ✓ Scan all instructions + CPI inner instructions
   ✓ USDC mint address matches
   ✓ Amount within 2% tolerance
   ✓ Signature not already settled
   Fail → ledger.status = failed, return 422

7. Dispatch to OnMeta (PATH A)
   POST https://api.onmeta.in/v1/offramp/initiate
   {amount_usdc, upi_id, fiat_amount, currency: "INR"}
   Success → ledger.status = completed, settlements.utr = "YESB..."
   Fail → settlements.status = pending (worker retries)

8. Return result
   Success: { paymentId, utr, status: "completed" }
   Queued: { paymentId, status: "settling" } → poll for updates
```

### Phase 8 — Async Worker (if sync dispatch fails)

`/api/workers/settlement` runs on **Vercel Cron** every 30 seconds:

```
1. Fetch up to 10 pending settlements
2. Optimistic lock (UPDATE WHERE status='pending' AND retry_count < 3)
3. Quote expiry check — if expired, auto-refund
4. Price slippage guard — if FX moved >150bps, auto-refund
5. Execute payout:
   • provider="onmeta" → initiateOnMetaPayout()
   • provider="treasury_razorpay" → initiateRazorpayPayout()
6. On failure: classifyFailure() + decideRecovery()
   • retry → settlement stays pending, picked up next cron
   • switch_provider → create new settlement row with fallback
   • refund → executeRefund() sends USDC back to user
   • abandon → mark transaction failed
```

### Phase 9 — OnMeta Webhook (Confirmation)

When OnMeta completes the payout, it POSTs to `/api/webhooks/onmeta`:

**Verify HMAC-SHA256 signature** → then:

```
payout.completed
  ↓ updateSettlement(utr=..., status=completed)
  ↓ transitionTransaction(→ completed)
  ↓ Writes directly to Supabase (not in-memory store) ✅

payout.failed
  ↓ updateSettlement(status=failed)
  ↓ transitionTransaction(→ failed) if no fallback available
  ↓ Settlement worker gets second chance with PATH B

payout.processing
  ↓ Acknowledge only, no state change
```

**Why direct Supabase writes:** Previous version wrote to in-memory `Map`. On Vercel's serverless, each invocation is a separate process — those writes were invisible to the status poller. Now persists across all invocations.

### Phase 10 — Status Polling + Receipt

`PaymentStatusTracker` polls `GET /api/v1/payment/:id` every 2–4 seconds:

```json
{
  "status": "completed",
  "utr": "YESB178011620946032853",
  "settled_at": "2026-06-03T10:42:18Z",
  "audit_trail": [
    { "state": "initiated",  "at": "T+0.0s" },
    { "state": "quoted",     "at": "T+0.3s" },
    { "state": "signed",     "at": "T+0.8s" },
    { "state": "verified",   "at": "T+2.1s" },
    { "state": "settling",   "at": "T+2.4s" },
    { "state": "completed",  "at": "T+14.2s" }
  ]
}
```

`RevealCard` displays the UTR to user. `PaymentReceipt` generates a SHA-256 receipt hash. **Merchant has received INR. End-to-end settlement complete.**

---

## Component Status & Implementation

| Component | Dev | Staging | Prod |
|---|---|---|---|
| Auth (Google/phone) | ✅ | ✅ | ⏳ KYC gate |
| Phantom wallet (desktop + mobile) | ✅ | ✅ | ✅ |
| Claude AI intent parsing | ✅ | ✅ | ✅ (rate-limited) |
| Live FX rate (CoinGecko) | ✅ | ✅ | ✅ |
| 6-layer security | ✅ | ✅ | ✅ |
| Liquidity gate | ✅ | ✅ | ✅ (NEW) |
| Solana USDC transfer | ✅ | ✅ | ⏳ Mainnet |
| On-chain 7-step verification | ✅ | ✅ | ⏳ Mainnet |
| Supabase ledger + state machine | ✅ | ✅ | ✅ |
| Settlement worker + reconciliation | ✅ | ✅ | ✅ |
| Failure classification + auto-refund | ✅ | ✅ | ✅ |
| OnMeta webhook → Supabase | ✅ | ✅ | ⏳ API keys (KYB) |
| Anchor savings vault | ✅ | ✅ | ⏳ Mainnet |
| Razorpay X dispatch (PATH B) | ✅ | ✅ | ⏳ Account ID (biz reg) |

---

## Replayable Receipts

Every completed payment produces a cryptographically verifiable receipt:

```json
{
  "payment_id": "pay_8x92kL",
  "internal_id": "uuid",
  "on_chain_hash": "5KtPxQ...wR2",
  "on_chain_timestamp": "2026-06-04T10:42:18Z",
  "usdc_amount": 5.410000,
  "inr_amount": 450.00,
  "fx_rate": 83.18,
  "merchant_upi_id": "merchant@paytm",
  "utr_number": "YESB178011620946032853",
  "receipt_hash": "sha256:a3f9...",
  "audit_trail": [
    { "from": null,        "to": "initiated", "at": "T+0s" },
    { "from": "initiated", "to": "verified",  "at": "T+2.1s" },
    { "from": "verified",  "to": "settling",  "at": "T+2.4s" },
    { "from": "settling",  "to": "completed", "at": "T+14.2s" }
  ],
  "verify": {
    "canonical": "payment_id|on_chain_hash|usdc|inr|upi_id|wallet|confirmed_at",
    "explorer": "https://solscan.io/tx/5KtPxQ...wR2"
  }
}
```

The `receipt_hash` is a SHA-256 of canonical fields. Anyone can recompute it independently and verify Auron's records have not been altered.

**GET** `/api/receipt/:paymentId`

---

## Internal Ledger

Auron maintains a financial ledger independent of blockchain state — the same pattern Stripe, Razorpay, and Wise use to manage payment state across unreliable external systems.

```sql
transactions     — single source of truth for every payment intent
settlements      — one row per attempt; provider payout ID, UTR, failure stage
status_history   — append-only audit trail; every transition with timestamp + reason
```

Row-level security is enabled on all tables. All writes go through the service role key on server-side routes — the client never touches the ledger directly.

Blockchain finality ≠ settlement finality. A confirmed Solana transaction does not mean a merchant received INR. The ledger tracks the full chain of custody.

---

## Developer API

```typescript
// Initiate a settlement
const result = await auron.settle({
  amount_usdc:     5.41,
  inr_amount:      450,
  recipient_upi:   "merchant@paytm",
  tx_signature:    "5KtPxQ...wR2",
  idempotency_key: "order_84729",
});

// Result
{
  payment_id:    "pay_8x92kL",
  status:        "completed",
  utr:           "YESB178011620946032853",
  settled_at:    "2026-06-04T10:42:18Z",
  inr_delivered: 450,
  provider:      "onmeta",
  receipt_hash:  "sha256:a3f9..."
}
```

**Built in from day one:**
- `idempotency_key` — safe to retry, duplicate requests return cached results
- `settlement.completed` / `settlement.failed` / `settlement.updated` webhook events
- Full audit trail at `/api/receipt/:paymentId`
- Auto-recovery — stuck settlements detected, retried, and classified automatically
- TypeScript SDK — `npm install @auron/sdk`

---

## On-Chain Verification

Settlement never executes on an unverified transaction. Verification is a synchronous hard gate, not a background check.

Before settlement, the server independently:

1. Fetches the parsed transaction from Solana RPC
2. Confirms `confirmed` or `finalized` commitment status
3. Rejects transactions with any error field set
4. Scans **all instructions including CPI inner instructions** — required because Phantom routes USDC transfers through the Associated Token Program, making the transfer invisible to top-level instruction inspection
5. Verifies USDC mint address against expected devnet/mainnet mint
6. Validates transfer amount within 2% tolerance (handles FX rounding)
7. Checks idempotency — already-settled signatures are rejected at the database level via a partial unique index

If any check fails, the ledger is marked `failed` and the client receives a hard error. No settlement proceeds.

---

## Solana Anchor Program

Custom Anchor program providing time-locked USDC custody. Treasury logic is enforced at the program level — not database-enforced.

- **Program ID:** `B5DwqnCoDrY8ezfGaZfpAnvZ4FwCtPNHk6vT5nRgFENg` (devnet)
- **PDA:** `[b"vault", owner_pubkey]` — one vault per user, deterministic address
- **USDC custody:** held in an ATA owned by the PDA — no party can access funds until `clock::unix_timestamp >= unlock_timestamp`

```rust
pub fn lock_savings(ctx, amount: u64, unlock_timestamp: i64, label: String) -> Result<()>
pub fn unlock_savings(ctx) -> Result<()>
```

---

## Solana Blinks

Full implementation of the Solana Actions spec. Every pay link is simultaneously a human-readable payment page and a composable action operable inside X/Twitter, Dialect, and Phantom without leaving the host surface.

```
GET  /api/actions/pay  →  action metadata + label
POST /api/actions/pay  →  serialized transaction for wallet signing
```

Paste any Auron pay link into a tweet — it becomes an executable payment, natively, with no redirect.

---

## Why Solana

Sub-second finality and near-zero fees make the on-chain leg of the payment flow invisible to users. A USDC transfer confirms in ~400ms at a cost of ~$0.00025 — fast enough that waiting for it is not a UX problem.

The composability story (Blinks, Actions) creates distribution primitives that don't exist on slower chains.

**The architecture is designed for multi-rail expansion. Solana is the current settlement rail. It is not the product.**

---

## Roadmap

### Phase 1 — Settlement Infrastructure *(current)*

The foundation. Every payment primitive required for production-grade stablecoin settlement.

- ✅ Programmable payment intent layer (Claude AI)
- ✅ Internal ledger with full lifecycle management
- ✅ 7-step on-chain verification engine
- ✅ Queue-based settlement orchestration
- ✅ Failure classification + auto-recovery system
- ✅ Price guard + quote expiry protection
- ✅ Liquidity model with pre-payment gates
- ✅ Auto-refund engine (on-chain USDC return)
- ✅ Replayable receipts with SHA-256 integrity hash
- ✅ Time-locked treasury vault (Anchor program)
- ✅ Solana Blinks + composable pay links
- ⏳ OnMeta KYB approval (3–7 days)
- ⏳ Mainnet deployment

---

### Phase 2 — Treasury Primitives

Turning Auron from a payment processor into a treasury coordination layer.

- Merchant settlement APIs — batch payouts, scheduled transfers
- Programmable payment splits and escrow
- Developer SDK — `npm install @auron/sdk` with full TypeScript types
- Webhooks + event streaming
- Agent-authorized recurring settlement
- Compliance and reconciliation tooling
- Multi-currency support (USDT, USDC, EURC)
- Expanded liquidity provider routing (Transak, Stripe, manual network)
- INR float treasury management

---

### Phase 3 — AI-Native Financial Orchestration

The layer that makes Auron infrastructure-grade.

- AI agent payment APIs — machine-readable settlement primitives
- Autonomous treasury balancing — AI-managed liquidity routing
- Conditional payment workflows — programmable escrow, milestone releases
- Agentic commerce infrastructure — AI systems that can hold, route, and settle value
- Cross-network abstraction — Solana, Ethereum, Base, Starknet behind one interface
- Programmable collateral and yield — treasury-backed financial products
- Sub-account architecture — businesses run isolated treasury environments on Auron rails

---

### Phase 4 — Sovereign Infrastructure

Where Auron becomes an independent financial coordination network.

- Multi-rail settlement — SWIFT, Stellar, Lightning, ACH, SEPA
- Institutional treasury APIs
- Intelligent liquidity routing across rails and networks
- RWA coordination — invoice liquidity, merchant receivables, short-term credit
- B2B settlement network — exchanges, payroll, gaming platforms, SaaS billing
- Regulatory framework — VDA reporting, FEMA compliance, licensed operations
- Global expansion — Southeast Asia, MENA, LATAM corridors

---

## Vision

Most people still think about finance as humans manually transacting.

The future is different.

AI assistants will purchase services. Autonomous agents will manage subscriptions, balance treasuries, and settle supplier invoices. Software systems will execute financial actions the way they execute API calls today — instantly, programmatically, without human intervention.

Those systems need financial coordination infrastructure that is:

- **Programmable** — not just executable, but composable and conditional
- **Verifiable** — every action on-chain and auditable
- **Intelligent** — routing, recovery, and optimization happen automatically
- **Invisible** — developers and users should not think about blockchain

Auron is not trying to become the cheapest way to send a payment.

Auron is building **the operating layer for programmable money** — the infrastructure that will coordinate stablecoin movement between users, merchants, businesses, and AI systems when the programmable finance era arrives.

> The strongest infrastructure companies are invisible. Users should not think: "I'm using blockchain." They should think: "It just works."

---

## Growth Model

### Stage 1 — Crypto Community (0 → 1,000 users)

The people who already hold USDC and want to spend it are already organized — in Telegram groups, Solana India Discord, r/IndiaCrypto. A 30-second video of scan → confirm → merchant paid in INR is viral content in those communities.

Cost: ₹0. Timeline: 1 week post-mainnet.

### Stage 2 — College Campuses (1,000 → 10,000 users)

Engineering college crypto clubs across India. Students who hold crypto but can't spend it. One live demo at a tech fest — filmed and posted — spreads across every engineering college WhatsApp group in 48 hours.

### Stage 3 — Referral Loop (10,000 → 100,000 users)

Invite a friend → both get 3 free premium payments. Every crypto holder knows other crypto holders. The network is tight.

### Stage 4 — Merchant Flywheel (100,000 → 1,000,000 users)

Once merchants display Auron QRs, the merchant IS the distribution. Every shop displaying a QR passively acquires new users. This is how PhonePe scaled. It is automatic.

### Stage 5 — B2B API (1M+ users)

Transaction volume becomes the credibility needed to approach exchanges, payroll platforms, and gaming companies. One B2B partnership adds 50,000 users overnight.

---

## Unit Economics

At 10,000 transactions/day averaging ₹400:

| Source | Daily | Annual |
|---|---|---|
| FX spread (0.85%) | ₹34,000 | ₹12.4M |
| OnMeta fees (~0.5%) | −₹20,000 | −₹7.3M |
| **Net** | **₹14,000** | **₹5.1M (~$61K USD)** |

Phase 2 adds: developer API licensing, treasury management fees, and settlement volume from B2B partnerships.

---

## Local Setup

```bash
git clone https://github.com/your-username/auron
cd auron/apps/web
npm install
cp .env.example .env.local
npm run dev
```

**Required environment variables:**

```bash
ANTHROPIC_API_KEY              # Claude intent parsing
NEXT_PUBLIC_SUPABASE_URL       # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY  # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY      # Service role key (server-side only)
```

**Database — run in Supabase SQL Editor:**

```bash
# Initial schema
apps/web/lib/db/schema.sql

# Migration 001 (receipt hash + refund columns)
apps/web/lib/db/migration_001_receipt_refund.sql
```

**Optional:**

```bash
ONMETA_API_KEY          # Leave unset for demo mode (simulated payout)
RAZORPAY_KEY_ID         # Razorpay payout credentials
RAZORPAY_KEY_SECRET
RAZORPAY_ACCOUNT_ID
TREASURY_KEYPAIR_BASE58 # Treasury wallet private key (for auto-refunds)
SOLANA_RPC_URL          # Defaults to public devnet RPC
DEMO_SETTLEMENT=true    # Skip real payout, TX verification still runs
CRON_SECRET             # Protects /api/workers/* in production
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 App Router, TypeScript |
| Intent Engine | Claude Sonnet — structured parsing, prompt caching |
| Settlement Rail | Solana — USDC SPL transfers, Anchor vault program |
| Ledger | Supabase PostgreSQL — transactions, settlements, audit trail |
| Auth | Supabase — Google OAuth + phone OTP |
| Wallet | Phantom — desktop + mobile deep link |
| Offramp (primary) | OnMeta — USDC → INR via UPI |
| Offramp (fallback) | Razorpay X — UPI payouts from INR float |
| Rate Limiting | Vercel KV |
| Security | argon2id PIN, CSP headers, RLS on all DB tables |
| Mobile | Capacitor — Android app |
| Distribution | Solana Blinks, shareable pay links, PWA |
| Monitoring | Sentry, Vercel Analytics |

---

## Repository Structure

```
auron/
├── apps/
│   └── web/                    # Next.js 15 application
│       ├── app/
│       │   ├── api/
│       │   │   ├── parse-intent/   # Claude intent parsing
│       │   │   ├── quote/          # FX quote engine
│       │   │   ├── payment/        # Payment initiation
│       │   │   ├── offramp/        # Settlement execution
│       │   │   ├── receipt/        # Replayable receipts
│       │   │   ├── workers/
│       │   │   │   ├── settlement/ # Async settlement worker
│       │   │   │   └── reconcile/  # Reconciliation worker
│       │   │   └── webhooks/       # Provider webhook handlers
│       │   └── [pages]/
│       ├── components/             # UI components
│       └── lib/
│           ├── failure.ts          # Failure classification + recovery
│           ├── refund.ts           # USDC refund executor
│           ├── liquidity.ts        # Treasury liquidity model
│           ├── payment-state.ts    # State machine + receipt hash
│           ├── verify-tx.ts        # On-chain verification
│           ├── routing.ts          # Provider routing engine
│           ├── retry.ts            # Exponential backoff + jitter
│           ├── quote.ts            # FX quote engine
│           ├── onmeta.ts           # OnMeta integration
│           ├── razorpay.ts         # Razorpay integration
│           ├── treasury.ts         # Treasury balance tracking
│           └── db/
│               ├── ledger.ts       # Ledger data access layer
│               ├── schema.sql      # Initial schema
│               ├── migration_001_receipt_refund.sql
│               └── types.ts        # TypeScript types
├── programs/
│   └── savings-vault/              # Anchor vault program (Solana)
└── packages/
    └── sdk/                        # @auron/sdk (in progress)
```

---

## Current Stage

> Early-stage financial infrastructure with real production architecture.

Not yet: institutional-grade, regulated, enterprise-ready.

Already beyond: hackathon demos, frontend-only apps, basic payment wrappers.

The next milestone is mainnet deployment with production settlement credentials — then the first real merchant, the first viral moment, and the beginning of the network flywheel.

---

*Auron is programmable financial infrastructure that currently settles on Solana.*
*Built from India. Built for the stablecoin internet.*
