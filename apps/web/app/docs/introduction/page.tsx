import type { Metadata } from "next";
import CodeBlock from "@/components/docs/CodeBlock";
import Callout   from "@/components/docs/Callout";
import PageNav   from "@/components/docs/PageNav";

export const metadata: Metadata = { title: "Introduction" };

export default function Introduction() {
  return (
    <div className="prose">
      <p className="mono-label">Overview</p>
      <h1>Introduction to Auron</h1>
      <p style={{ fontSize: "1.0625rem", color: "var(--text-muted)", maxWidth: 600, marginBottom: "2rem" }}>
        A programmable financial infrastructure layer. USDC moves on Solana — merchants receive INR via UPI. The blockchain stays invisible to both sides.
      </p>

      <div className="inline-flex items-center gap-2 mb-8" style={{ border: "1px solid var(--border)", background: "var(--surface)", padding: "6px 14px", borderRadius: 100, fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.06em" }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--lime)", flexShrink: 0, display: "inline-block" }} />
        LIVE ON SOLANA DEVNET
      </div>

      <hr />

      <h2>What Auron is</h2>
      <p>
        Crypto solved sending dollars. It never finished the payment. A freelancer paid in USDC still can&apos;t pay rent with it. Auron finishes the payment.
      </p>
      <p>
        The goal is not to become another crypto payment app. The goal is to become <strong style={{ color: "var(--text)" }}>the programmable financial infrastructure layer that powers stablecoin movement between users, merchants, businesses, and AI systems globally.</strong>
      </p>

      <h2>The core flow</h2>
      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, padding: "20px 24px", fontFamily: "'Geist Mono', monospace", fontSize: 12, lineHeight: 2.2 }}>
        <div style={{ color: "var(--text-muted)" }}>User types <span style={{ color: "var(--lime)" }}>&ldquo;pay ₹500 to Swiggy&rdquo;</span></div>
        <div style={{ color: "var(--text-dim)", fontSize: 11, paddingLeft: 20 }}>↓  Claude AI parses intent</div>
        <div style={{ color: "var(--text-muted)" }}>Phantom signs USDC transfer</div>
        <div style={{ color: "var(--text-dim)", fontSize: 11, paddingLeft: 20 }}>↓  7-step on-chain verification (hard gate)</div>
        <div style={{ color: "var(--text-muted)" }}>OnMeta / Razorpay dispatches INR payout</div>
        <div style={{ color: "var(--text-dim)", fontSize: 11, paddingLeft: 20 }}>↓  ~5 seconds average</div>
        <div style={{ color: "var(--lime)" }}>Merchant receives ₹500 via UPI · gets UTR</div>
      </div>

      <hr />

      <h2>What&apos;s live today</h2>
      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {[
          ["Payment intent layer",       "Natural language → structured action via Claude AI"],
          ["FX quote engine",            "Live CoinGecko rate · 0.85% spread · 60s locked quote"],
          ["On-chain verification",      "7-step USDC transfer verification — hard gate before any settlement"],
          ["Internal ledger",            "Postgres-backed · 14-state machine · append-only audit trail"],
          ["Failure & recovery system",  "Auto-classification · provider switching · auto-refund"],
          ["Settlement workers",         "Async queue · optimistic locking · reconciliation worker"],
          ["Liquidity model",            "Treasury tracking · in-flight USDC · pre-payment gates"],
          ["Replayable receipts",        "SHA-256 canonical receipts with full audit trail"],
          ["Anchor vault program",       "Time-locked USDC custody · PDA-enforced on devnet"],
          ["Solana Blinks",              "Every pay link is a composable action inside X/Twitter"],
          ["6-layer security",           "Risk scoring · spend ceiling · scam detection · argon2id PIN"],
        ].map(([component, desc], i, arr) => (
          <div key={component} className="flex gap-5 px-5 py-3" style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}>
            <div className="flex items-center gap-2" style={{ width: 220, flexShrink: 0 }}>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, color: "var(--lime)" }}>●</span>
              <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text)", fontWeight: 500 }}>{component}</span>
            </div>
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-muted)" }}>{desc}</span>
          </div>
        ))}
      </div>

      <Callout type="info">
        One step is currently simulated: the final INR payout, pending OnMeta production KYB approval. Simulated payouts are explicitly labeled on the public stats page. Nothing is disguised.
      </Callout>

      <hr />

      <h2>Two integration modes</h2>

      <h3>Human wallet mode — for consumer apps</h3>
      <p>No API key required. The user connects Phantom, signs the USDC transfer in their wallet, and the frontend submits the signature to Auron. Your app never touches a private key.</p>

      <h3>SDK mode — for apps and AI agents</h3>
      <p>Authenticate with an <code>ak_live_xxx</code> API key. Call <code>getQuote()</code>, build your UI, submit the transaction signature for settlement. Daily spend limits enforced per key. Machines can initiate payments without any browser interaction.</p>

      <h2>Quick example</h2>
      <CodeBlock
        language="ts"
        filename="checkout.ts"
        code={`import { AuronClient } from "@auron-solana/sdk";

const auron = new AuronClient({
  apiKey:  "ak_live_xxx",
  baseUrl: "https://auron-mocha.vercel.app",
});

// 1. Get a live USDC quote for ₹999
const quote = await auron.getQuote(999);
// quote.usdcAmount → 11.84
// quote.auronRate  → 84.37 INR/USDC

// 2. After user signs the on-chain transfer:
await fetch("/api/v1/pay", {
  method:  "POST",
  headers: { "Content-Type": "application/json", "x-api-key": "ak_live_xxx" },
  body: JSON.stringify({
    txSignature:    "<solana_tx_signature>",
    merchantUpiId:  "merchant@paytm",
    inrAmount:      999,
    usdcAmount:     quote.usdcAmount,
    paymentId:      crypto.randomUUID().replace(/-/g, ""),
    idempotencyKey: crypto.randomUUID().replace(/-/g, ""),
  }),
});`}
      />

      <h2>Where to go next</h2>
      <ul>
        <li><a href="/docs/vision">Vision & Roadmap</a> — the 4-phase trajectory from settlement to sovereign infrastructure</li>
        <li><a href="/docs/the-app">The Auron App</a> — AI chat, QR scanner, onboarding, Blinks, ConfirmCard</li>
        <li><a href="/docs/architecture">System Architecture</a> — ledger, failure recovery, liquidity model</li>
        <li><a href="/docs/quickstart">Quick Start</a> — zero to working payment in 5 minutes</li>
      </ul>

      <PageNav />
    </div>
  );
}
