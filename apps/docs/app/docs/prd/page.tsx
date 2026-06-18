import type { Metadata } from "next";
import Callout from "@/components/Callout";
import PageNav from "@/components/PageNav";

export const metadata: Metadata = { title: "Product Requirements" };


function Metric({ label, target, current }: { label: string; target: string; current?: string }) {
  return (
    <div className="flex items-start justify-between px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
      <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-muted)", flex: 1 }}>{label}</span>
      <div className="text-right" style={{ flexShrink: 0, paddingLeft: 24 }}>
        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "var(--lime)", display: "block" }}>{target}</span>
        {current && <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: "var(--text-dim)" }}>now: {current}</span>}
      </div>
    </div>
  );
}

export default function PRD() {
  return (
    <div className="prose">
      <p className="mono-label">Company</p>
      <h1>Product Requirements</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
        Defines what Auron is building, for whom, and how success is measured. Phase 1 scope only.
      </p>
      <hr />

      <h2>Problem</h2>
      <p>
        India has 350M+ UPI users and one of the most active real-time payment networks on earth. Crypto holders in India — freelancers paid in USDC, developers earning in stablecoins, Web3 users — cannot spend their assets in the real economy without going through centralized exchanges, 2–5 day settlement delays, and high withdrawal fees.
      </p>
      <p>On the other side: merchants cannot accept crypto even if they wanted to. They have no wallet, no node, no tolerance for volatility. UPI is their entire payment reality.</p>
      <p>
        <strong style={{ color: "var(--text)" }}>The gap:</strong> no programmable, developer-accessible layer that connects stablecoin holders to the UPI economy — with proper verification, state tracking, and failure recovery.
      </p>

      <hr />

      <h2>Target users</h2>
      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {[
          { segment: "Crypto-native consumers",  desc: "Hold USDC/SOL from freelancing, DeFi, or airdrops. Want to spend it without cashing out to a bank first. Have Phantom installed." },
          { segment: "Web3 developers",          desc: "Building payment flows on Solana. Need a settlement API they don't have to build from scratch. Want TypeScript SDK + webhooks." },
          { segment: "AI agent builders",        desc: "Building autonomous agents that need to initiate real-world financial transactions. Need machine-readable APIs with spend limits and idempotency." },
          { segment: "Indian merchants",          desc: "Already on UPI. Don't know or care about crypto. Just want to get paid. Auron is invisible to them." },
        ].map((u, i, arr) => (
          <div key={u.segment} className="px-5 py-4" style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}>
            <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 13, color: "var(--text)", margin: "0 0 4px" }}>{u.segment}</p>
            <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{u.desc}</p>
          </div>
        ))}
      </div>

      <hr />

      <h2>User stories</h2>

      <h3>Consumer</h3>
      <UserStory
        role="crypto-native consumer"
        action="pay any UPI merchant using my USDC without touching a bank"
        outcome="I can spend crypto at any Indian merchant without cashing out first"
      />
      <UserStory
        role="crypto-native consumer"
        action="say 'pay ₹500 to Swiggy' and have it just work"
        outcome="I don't need to know wallet addresses, mints, or gas fees"
      />
      <UserStory
        role="crypto-native consumer"
        action="scan a merchant's QR code and pay in USDC"
        outcome="existing merchant infrastructure works — they don't need to change anything"
      />
      <UserStory
        role="crypto-native consumer"
        action="get a cryptographic receipt with a Solscan link"
        outcome="I can prove the payment happened independently of Auron"
      />

      <h3>Developer</h3>
      <UserStory
        role="developer"
        action="integrate USDC → INR settlement into my app in under 30 minutes"
        outcome="I don't have to build or maintain payment infrastructure"
      />
      <UserStory
        role="developer"
        action="receive webhooks when a payment completes or fails"
        outcome="my backend can react to settlement outcomes without polling"
      />
      <UserStory
        role="developer"
        action="retry a failed payment safely using idempotency keys"
        outcome="retries never cause double charges"
      />

      <h3>AI agent</h3>
      <UserStory
        role="AI agent"
        action="call getQuote() and then POST /api/v1/pay with a signed transaction"
        outcome="the agent can settle payments autonomously without human intervention"
      />
      <UserStory
        role="AI agent builder"
        action="set a daily spend limit on each API key"
        outcome="a runaway agent cannot drain the treasury"
      />

      <hr />

      <h2>Phase 1 features</h2>

      <h3>Must have</h3>
      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {[
          "AI natural language intent parsing (Claude Sonnet)",
          "QR scanner — decode UPI QR, extract merchant details",
          "Live FX quote with 60-second TTL and price guard",
          "USDC transfer via Phantom (desktop + mobile deep link)",
          "7-step on-chain transaction verification",
          "INR settlement via OnMeta (primary) + Razorpay X (fallback)",
          "14-state payment lifecycle with immutable audit trail",
          "Failure classification + auto-refund engine",
          "Replayable SHA-256 receipts at /api/receipt/:id",
          "6-layer security: risk scoring, spend ceiling, scam detection, argon2id PIN",
          "Idempotency — safe retries, no double settlements",
          "Solana Blinks — composable pay links",
        ].map((f, i, arr) => (
          <div key={f} className="flex items-center gap-3 px-5 py-2.5" style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "var(--lime)", flexShrink: 0 }}>✓</span>
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-muted)" }}>{f}</span>
          </div>
        ))}
      </div>

      <h3>Out of scope for Phase 1</h3>
      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {[
          "Multi-currency support (USDT, EURC) — Phase 2",
          "Batch payouts / scheduled transfers — Phase 2",
          "Cross-chain abstraction (Ethereum, Base) — Phase 3",
          "AI-managed autonomous treasury — Phase 3",
          "RWA yield products — Phase 4",
        ].map((f, i, arr) => (
          <div key={f} className="flex items-center gap-3 px-5 py-2.5" style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "var(--text-dim)", flexShrink: 0 }}>—</span>
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-dim)" }}>{f}</span>
          </div>
        ))}
      </div>

      <hr />

      <h2>Success metrics</h2>
      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        <Metric label="End-to-end settlement time" target="< 20 seconds" current="~5 s average on devnet" />
        <Metric label="Payment success rate" target="> 98%" current="100% on devnet (12 induced failures, all auto-resolved)" />
        <Metric label="On-chain verification latency" target="< 3 seconds" current="~2.1 s average" />
        <Metric label="Monthly active payers (6 months post-mainnet)" target="1,000" />
        <Metric label="Daily payment volume (6 months post-mainnet)" target="₹5,00,000+ / day" />
        <Metric label="Protocol revenue (6 months post-mainnet)" target="₹14,000+ / day net" />
        <Metric label="API uptime" target="99.9%" />
        <div className="px-5 py-3">
          <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-muted)" }}>Zero incidents where funds were lost or stuck without auto-recovery</span>
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "var(--lime)", display: "block", textAlign: "right", marginTop: 2 }}>always</span>
        </div>
      </div>

      <hr />

      <h2>Technical requirements</h2>
      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {[
          ["Settlement atomicity",    "Both ledger record and settlement row must update together — no partial state"],
          ["Idempotency",             "Every payment endpoint must accept idempotency keys and return cached results on replay"],
          ["No fund loss on failure", "Any terminal failure triggers automatic USDC return to user's on-chain wallet"],
          ["Audit completeness",      "Every state transition must be recorded in status_history with timestamp and reason"],
          ["Server-side secrets",     "No private keys, API keys, or treasury credentials may appear in client bundles"],
          ["Quote integrity",         "Server rejects settlements where live FX rate has moved >150 bps from quoted rate"],
          ["Replay protection",       "A settled transaction signature must never trigger a second settlement"],
        ].map(([req, desc], i, arr) => (
          <div key={req} className="px-5 py-3" style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}>
            <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 13, color: "var(--text)", margin: "0 0 3px" }}>{req}</p>
            <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{desc}</p>
          </div>
        ))}
      </div>

      <Callout type="info">
        These requirements are non-negotiable and enforced in code — not just documented. Each one has a corresponding test path in the settlement worker or verification layer.
      </Callout>

      <PageNav />
    </div>
  );
}
