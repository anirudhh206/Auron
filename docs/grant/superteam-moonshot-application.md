# Auron — Superteam India Moonshot Fund Application

**Focus area:** Payments / Stablecoins
**Ask:** $10,000 USDG
**Builder:** Anirudh Vashisth — solo founder, India
**Live app:** https://auron-mocha.vercel.app
**GitHub:** https://github.com/anirudhh206/Auron
**Live stats (public, real-time):** https://auron-mocha.vercel.app/stats

---

## One line

**Crypto solved sending dollars. It never finished the payment.**

A freelancer paid in USDC still can't pay rent with it. Auron finishes the payment: USDC in a Phantom wallet → verified on-chain → rupees delivered over UPI, in seconds, through licensed offramp partners.

## What is working today (and what is simulated — stated plainly)

The entire settlement pipeline is live and verifiable: on-chain USDC transfer, 7-point verification, quote lock, state machine, ledger, routing, auto-refund. **One step is simulated: the final INR payout**, pending OnMeta production KYB. Simulated payouts are explicitly labeled on our public stats page — nothing is disguised. The $10K grant closes exactly this gap.

Every claim is one click from verification:

| Proof | Link |
|---|---|
| Live product | https://auron-mocha.vercel.app |
| Live ledger stats (demo payouts clearly labeled) | https://auron-mocha.vercel.app/stats |
| Verifiable on-chain TX (Solscan, devnet) | `2R9gJVXi3zA1eG7js8pXUhnjQDFt1zYAqhZ5gArrAXdRyyKuhSeqKeKAVzCMec1LSkr1Xy5Qyf4C6wRZwknGxLNz` |
| Open-source repo | https://github.com/anirudhh206/Auron |
| Solana Blink (Actions spec) | https://auron-mocha.vercel.app/api/actions/pay?to=demo&amount=500&currency=INR |
| Pay link | https://auron-mocha.vercel.app/pay/demo?amount=500&note=Lunch |
| Android app | Capacitor build in repo (`apps/web/android`) |
| Colosseum hackathon — **$4,000 USDC side-track winner** | *(add your Colosseum project / announcement link)* |

## What Auron is — verified settlement, not a wallet, not an escrow

The primitive is **verified settlement**: no rupee moves until the on-chain leg is proven, and no failure can strand funds.

1. **7-point on-chain verification gate** — signature, mint, amount, recipient, finality, replay, age — checked independently before any payout. No verified deposit, no payout.
2. **9-state payment lifecycle** — every payment moves through a deterministic state machine recorded in an append-only Postgres ledger.
3. **3-path routing with automatic failover** — OnMeta (primary) → Razorpay X (fallback) → manual queue, scored provider selection.
4. **Auto-refund engine** — terminal failure triggers an on-chain USDC return automatically. Tested in production: 12 induced failures in our ledger, every one resolved without manual intervention; 1 stuck settlement recovered by the daily reconciliation worker.
5. **Verifiable receipts** — SHA-256 canonical receipt hash for every settlement; anyone can independently verify a payment occurred.
6. **AI-native** — natural-language payment intent (Claude-parsed, 6-layer security: urgency detection, spend ceilings, risk scoring) plus a documented `/api/v1/pay` endpoint so agents and apps settle programmatically — the same direction as x402-style internet-native payments.

## Traction (live ledger, June 2026)

- 29 payments processed through the full pipeline (devnet USDC)
- ₹9,000+ equivalent settled, ~97 USDC processed
- Average settlement: **5 seconds** from on-chain verification to payout confirmation
- 136 append-only ledger entries; full audit trail public at `/stats`
- 0.82 USDC protocol revenue accrued from the 0.85% spread — the business model runs from transaction one
- Failure handling proven in production: 12 failure-path tests, 100% auto-resolved

## Why this rail, why now

India has the world's best fiat rail — UPI, 13B+ transactions a month — and no open, programmable bridge from stablecoins into it. FIU-registered offramps made compliant USDC→INR programmatically possible only recently. **Auron never custodies INR** — fiat payout executes through licensed partners (OnMeta is FIU-registered; Razorpay X is RBI-licensed); Auron's role is verification, routing, state, and proof. This is the same corridor thesis as Credible, built bottom-up by an independent builder as open infrastructure rather than a closed bank product.

## Competitive position

Wallet-to-wallet USDC apps leave the recipient holding USDC. Escrow-swap projects carry stuck-fund risk and have no settlement infrastructure. Agent-payment tooling has no fiat leg. Auron finishes the job: crypto in, **rupees in a bank account** out, with cryptographic proof at every step.

## What $10,000 unlocks (milestones)

| Milestone | Target |
|---|---|
| OnMeta production KYB complete; first real UTR; mainnet USDC | July 2026 |
| INR float + treasury for ₹2L/day settlement capacity | August 2026 |
| 100 real mainnet settlements; public proof page with live success rate | September 2026 |
| Open-source release of the settlement engine post-mainnet (verification gate, state machine, routing) | September 2026 |
| Distributed rate limiting + sanctions screening (TRM/Range) for production compliance | October 2026 |

## About the builder

Solo builder from India. **Auron won a $4,000 USDC side track at the Colosseum hackathon (June 2026)** — external validation from Solana ecosystem judges. Beyond the prize, Auron is months of daily shipping, all public in the commit history: the verification engine, settlement and reconciliation workers, auto-refund engine, Anchor program on devnet, Solana Blinks, Android app. I build at the speed this corridor needs, and I'm committed to open-sourcing the settlement engine after mainnet deployment, per the grant's composability guidelines.

---

*Every number in this application is queryable from the public stats endpoint, and every simulated step is labeled as such. Don't trust us — verify.*
