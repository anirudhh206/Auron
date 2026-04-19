# Auron — The Blockchain That Disappears

> Type what you want. The blockchain does it. Invisibly.

**Auron** is a conversational AI interface built on Initia that lets anyone — with zero blockchain knowledge — perform real on-chain actions by typing plain English.

The user types. The AI interprets. The smart contract executes. The user sees a receipt. **The blockchain was invisible the entire time.**

---

## Live Demo

🔗 **App:** [https://auron.xyz](https://auron.xyz)
🎥 **Demo Video:** [Watch here](./demo/demo-video.mp4)

---

## What Auron Can Do

| Say this | Auron does this |
|---|---|
| `"Send Rs500 to Priya"` | Transfers tokens on-chain |
| `"Arjun owes me Rs2000 — save the agreement"` | Stamps a dual-signed agreement on-chain |
| `"Lock Rs10,000 for 3 months"` | Creates a timelock vault that **auto-earns ~12% APY** |
| `"Prove I own this photo"` | Records file ownership on-chain permanently |
| `"Claim my yield"` | Claims accrued interest from savings vault |

---

## Why Auron Wins

### The Problem
1 billion Indians have smartphones but can't use crypto — wallets are too complex, DeFi is too scary, every app assumes prior knowledge.

### The Solution
Auron makes blockchain **completely invisible**. The only interface is a chat box.

### The Moat
- **Yield on Savings Locks** — Only app on Initia offering auto-delegation with 12% APY. Users earn while they save, no effort required.
- **6-Layer Security** — Urgency detection, spend limits, hold-to-confirm, PIN auth, closed signing, daily caps. Designed for users who don't know what a private key is.
- **India-First** — Supports ₹ notation, Indian English (voice), `.init` usernames. Targets the 1.4B who already trust UPI.
- **Revenue Day 1** — Fee on every transaction (1.5% transfer, Rs5 agreement, 0.5% lock, Rs2 ownership). No token dependency.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Chain** | Optimistic Rollup Minitia on Initia L1, WasmVM, 100ms block time |
| **AI** | Claude Sonnet 4.6 (Anthropic) — with prompt caching |
| **Smart Contracts** | CosmWasm / Rust (4 contracts) |
| **Frontend** | Next.js 14, React 18, Tailwind CSS |
| **Wallet** | InterwovenKit (auto-signing, `.init` usernames, Interwoven Bridge) |
| **Security** | Argon2id PIN hashing, Vercel KV rate limiting, CSP headers |
| **Deployment** | Vercel |

---

## Initia-Native Features Used (All 3)

1. **Auto-signing / Session Keys** — Users pre-approve Auron contracts once. No wallet popup on every action.
2. **`.init` Usernames** — Human-readable addresses. "Send to priya.init" just works.
3. **Interwoven Bridge** — One-tap fund import from any chain on first login.

---

## Smart Contracts

| Contract | Address | Purpose |
|---|---|---|
| `transfer.wasm` | *See submission.json* | Token transfer with 1.5% fee |
| `agreement.wasm` | *See submission.json* | Dual-signed agreement stamping |
| `timelock.wasm` | *See submission.json* | Timelock vaults with auto-yield delegation |
| `ownership.wasm` | *See submission.json* | File ownership proof via SHA-256 |

---

## 6-Layer Security System

| Layer | Protection |
|---|---|
| **Intent Mirror** | Plain English confirmation before every transaction |
| **Smart Limits** | Personal spend ceiling, tap-and-hold for large amounts |
| **Urgency Detector** | Urgency keywords trigger mandatory 60-second cooldown |
| **Authentication** | PIN (argon2id hashed) + new device detection |
| **Closed Signing** | Wallet only works with Auron contract addresses |
| **Daily Caps** | Default Rs5,000/day, raising requires 24hr cooldown |

---

## Yield on Savings (Phase 1 Feature)

When a user locks savings:
1. Funds auto-delegate to Initia validator (~12% APY)
2. Yield accrues every block (100ms)
3. User can claim yield anytime without unlocking principal
4. On unlock: principal + all unclaimed yield returned to user

**For non-crypto users:** "It earns interest like a savings account"
**For crypto users:** "Real DeFi yield with auto-delegation"
**For Auron:** Zero cost to offer, creates massive retention

---

## Revenue Model

At 10,000 transactions/day:

| Action | Fee | Daily Revenue |
|---|---|---|
| Send money | 1.5% of amount | ~Rs7,500 |
| Save agreement | Rs5 flat | ~Rs50,000 |
| Lock savings | 0.5% of amount | ~Rs2,500 |
| Prove ownership | Rs2 flat | ~Rs20,000 |
| **Total** | | **~Rs80,000/day** |

---

## Local Development

```bash
# 1. Clone
git clone https://github.com/YOUR_USERNAME/auron
cd auron

# 2. Install frontend deps
cd frontend && npm install

# 3. Set up environment
cp .env.example .env.local
# Fill in ANTHROPIC_API_KEY and chain config

# 4. Run dev server
npm run dev
```

---

## Deploy Contracts

```bash
# 1. Build contracts (requires Rust + wasm32 target)
bash scripts/build_contracts.sh

# 2. Set up deployer secrets
cp scripts/.env.deploy.example scripts/.env.deploy
# Fill in DEPLOYER_MNEMONIC, TREASURY_ADDRESS, VALIDATOR_ADDRESS

# 3. Install script deps
cd scripts && npm install

# 4. Deploy
node deploy.js
```

---

## Project Structure

```
auron/
├── .initia/
│   └── submission.json
├── contracts/
│   ├── transfer/      # Token transfer (1.5% fee)
│   ├── agreement/     # Dual-signed agreements
│   ├── timelock/      # Savings locks + auto-yield
│   └── ownership/     # File ownership proof
├── frontend/
│   ├── app/           # Next.js pages + API routes
│   ├── components/    # UI components
│   ├── lib/           # Claude AI, contracts, security, utils
│   └── store/         # Zustand state management
├── scripts/
│   ├── deploy.js      # Contract deployment
│   └── build_contracts.sh
└── demo/
    └── demo-video.mp4
```

---

## Track

**AI Track** — Initia Minitia Hackathon

---

## Team

Built for the Initia Hackathon by the Auron team.

---

## License

MIT
