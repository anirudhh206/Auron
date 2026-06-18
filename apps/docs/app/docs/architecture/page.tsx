import type { Metadata } from "next";
import CodeBlock from "@/components/CodeBlock";
import Callout   from "@/components/Callout";
import PageNav   from "@/components/PageNav";

export const metadata: Metadata = { title: "System Architecture" };

export default function Architecture() {
  return (
    <div className="prose">
      <p className="mono-label">Architecture</p>
      <h1>System Architecture</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
        Auron is structured as five independent layers. Each is replaceable without touching the others — the blockchain is infrastructure, not the product.
      </p>
      <hr />

      <h2>Layers</h2>
      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, padding: "20px 24px", fontFamily: "'Geist Mono', monospace", fontSize: 12, lineHeight: 2 }}>
        {[
          ["AI Layer",                    "Claude Sonnet · natural language → structured payment action", "var(--lime)"],
          ["Financial Orchestration",     "Quote engine · routing · preflight · liquidity gate",          "var(--text-muted)"],
          ["Stablecoin Settlement Layer", "On-chain verification · state machine · ledger · workers",    "var(--text-muted)"],
          ["Blockchain Networks",         "Solana (primary) · chain-independent design",                  "var(--text-muted)"],
          ["Local Financial Rails",       "OnMeta (primary) · Razorpay X (fallback) · UPI",              "var(--text-muted)"],
        ].map(([layer, desc, color], i, arr) => (
          <div key={layer} style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)", paddingBottom: 8, marginBottom: 8 } : {}}>
            <span style={{ color, display: "inline-block", width: 240 }}>{layer}</span>
            <span style={{ color: "var(--text-dim)", fontSize: 11 }}>— {desc}</span>
          </div>
        ))}
      </div>

      <hr />

      <h2 id="lifecycle">Settlement lifecycle</h2>
      <p>Every payment moves through a deterministic, persisted state machine. No payment skips a state. No settlement fires on an unverified transaction.</p>

      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {[
          { state: "initiated",       note: "Payment record created"                             },
          { state: "quoted",          note: "FX rate locked for 60 s"                            },
          { state: "signed",          note: "User approved in Phantom"                           },
          { state: "verified",        note: "7-step on-chain hard gate passed"                   },
          { state: "routing",         note: "Provider selected — OnMeta or Razorpay"             },
          { state: "settling",        note: "Payout dispatched to provider"                      },
          { state: "completed",       note: "UTR received · merchant paid · terminal ✓"          },
          { state: "failed",          note: "Terminal ✗ · triggers auto-refund if eligible"      },
          { state: "refund_pending",  note: "USDC return queued"                                 },
          { state: "refunded",        note: "USDC returned on-chain · terminal ✓"               },
        ].map((s, i, arr) => {
          const terminal = ["completed", "failed", "refunded"].includes(s.state);
          return (
            <div key={s.state} className="flex gap-5 px-5 py-3" style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}>
              <code style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: terminal ? (s.state === "completed" || s.state === "refunded" ? "var(--lime)" : "#EF4444") : "var(--text)", background: "none", padding: 0, border: "none", width: 160, flexShrink: 0 }}>{s.state}</code>
              <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-muted)" }}>{s.note}</span>
            </div>
          );
        })}
      </div>

      <p>Every transition is <strong>atomic</strong> (both <code>transactions</code> and <code>status_history</code> update together), <strong>immutable</strong> (history rows are never updated or deleted), and <strong>recoverable</strong> (failure classification determines retry, provider switch, or auto-refund automatically).</p>

      <hr />

      <h2 id="ledger">Internal ledger</h2>
      <p>
        Auron maintains a financial ledger independent of blockchain state — the same pattern used by Stripe, Razorpay, and Wise to manage payment state across unreliable external systems.
      </p>
      <p style={{ fontWeight: 500, color: "var(--text)" }}>Blockchain finality ≠ settlement finality. A confirmed Solana transaction does not mean a merchant received INR.</p>

      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {[
          ["transactions",    "Single source of truth for every payment intent — created at phase 1, updated through all 14 states"],
          ["settlements",     "One row per attempt. Tracks: provider, payout ID, UTR, failure stage, retry count"],
          ["status_history",  "Append-only audit trail — every state transition with timestamp and reason. Never updated or deleted"],
        ].map(([table, desc], i, arr) => (
          <div key={table} className="flex gap-5 px-5 py-4" style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}>
            <code style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "var(--lime)", background: "none", padding: 0, border: "none", width: 160, flexShrink: 0 }}>{table}</code>
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-muted)" }}>{desc}</span>
          </div>
        ))}
      </div>

      <Callout type="info">
        Row-level security is enabled on all three tables. All writes go through the service role key on server-side routes — the client never touches the ledger directly.
      </Callout>

      <h3>Replayable receipts</h3>
      <p>Every completed payment produces a cryptographically verifiable receipt. The <code>receipt_hash</code> is a SHA-256 of canonical fields — anyone can independently recompute it and verify Auron&apos;s records have not been altered.</p>
      <CodeBlock
        language="json"
        code={`{
  "payment_id":    "pay_8x92kL",
  "on_chain_hash": "5KtPxQ...wR2",
  "usdc_amount":   5.41,
  "inr_amount":    450,
  "fx_rate":       83.18,
  "merchant_upi":  "merchant@paytm",
  "utr":           "YESB178011620946032853",
  "receipt_hash":  "sha256:a3f9...",
  "audit_trail": [
    { "state": "initiated",  "at": "T+0.0s" },
    { "state": "verified",   "at": "T+2.1s" },
    { "state": "settling",   "at": "T+2.4s" },
    { "state": "completed",  "at": "T+14.2s" }
  ]
}`}
      />
      <p>Receipts are available at <code>GET /api/receipt/:paymentId</code> — permanently, without authentication.</p>

      <hr />

      <h2 id="failure">Failure & recovery</h2>
      <p>When a settlement fails, the failure system answers three questions automatically — no manual intervention required.</p>

      <div style={{ marginTop: 20, marginBottom: 28 }}>
        {[
          { q: "What category is this?",  a: "14 pattern-matched failure categories: invalid UPI, timeout, rate limit, 5xx, FX expiry, slippage, insufficient balance, duplicate signature, and more." },
          { q: "Can we recover?",          a: "Retry with exponential backoff (5s → 15s → 45s), switch to fallback provider (OnMeta → Razorpay → manual), or queue for operator review." },
          { q: "Should we refund?",        a: "Auto-triggers USDC return to user's wallet on terminal failures — on-chain, verifiable, receipted." },
        ].map((item, i) => (
          <div key={item.q} className="flex gap-5" style={{ marginBottom: i < 2 ? 16 : 0 }}>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 24, fontWeight: 300, color: "var(--border-bright)", width: 32, flexShrink: 0, textAlign: "right", lineHeight: 1.2 }}>{String(i + 1).padStart(2, "0")}</span>
            <div style={{ paddingLeft: 14 }}>
              <span style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 14, color: "var(--text)", display: "block", marginBottom: 4 }}>{item.q}</span>
              <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.75, margin: 0 }}>{item.a}</p>
            </div>
          </div>
        ))}
      </div>

      <h3>Additional guards</h3>
      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {[
          ["Price guard",           "If FX rate moves >150 bps between quote and settlement → auto-refund"],
          ["Quote expiry",          "Server-side TTL check before every settlement attempt — 60 s hard limit"],
          ["Stuck payment detector","payment in settling >30 min → flagged · processing >10 min → reset to pending"],
          ["Signature replay",      "Settled signature stored in KV — re-submission returns 409 before touching Razorpay"],
        ].map(([guard, desc], i, arr) => (
          <div key={guard} className="flex gap-5 px-5 py-3" style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}>
            <code style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "var(--gold)", background: "none", padding: 0, border: "none", width: 200, flexShrink: 0 }}>{guard}</code>
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-muted)" }}>{desc}</span>
          </div>
        ))}
      </div>

      <hr />

      <h2 id="liquidity">Liquidity model</h2>
      <p>Every payment goes through a pre-payment liquidity gate before a Solana transaction is even built.</p>
      <CodeBlock
        language="ts"
        code={`// Pre-payment gate — checked BEFORE Phantom is invoked
const MIN_RESERVE_USDC   = 50        // always keep in treasury
const MAX_IN_FLIGHT_USDC = 10_000    // max concurrent exposure
const MAX_PAYMENT_USDC   = 5_000     // per-transaction cap
const MIN_PAYMENT_USDC   = 0.5       // minimum viable payment

// Decision:
// amount < 0.5 USDC                    → reject
// amount > 5,000 USDC                  → reject
// treasury < (reserve + amount)        → reject (503)
// inFlight + amount > 10,000           → reject
//                                      → ALLOWED`}
      />
      <p>Reserve alerts fire at 2× minimum. Critical alert at 1× minimum. Both are surfaced at <code>GET /api/stats</code>. In-flight USDC is tracked across all non-terminal payments in the Zustand store and cross-checked against the Supabase ledger.</p>

      <hr />

      <h2>Settlement providers</h2>
      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {[
          { path: "PATH A",    name: "OnMeta (primary)",      speed: "~20 s",    fee: "0.5%",  note: "USDC → INR directly. Requires KYB." },
          { path: "PATH B",    name: "Razorpay X (fallback)", speed: "~15 s",    fee: "0.99%", note: "INR float → UPI. Requires RazorpayX KYB." },
          { path: "PATH C",    name: "Manual review",         speed: "24–48 h",  fee: "—",     note: "Triggered when both providers fail or amount > $25K." },
        ].map((p, i, arr) => (
          <div key={p.path} className="px-5 py-4" style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}>
            <div className="flex items-center gap-3 mb-1">
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: "var(--lime)", letterSpacing: "0.08em" }}>{p.path}</span>
              <span style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 13, color: "var(--text)" }}>{p.name}</span>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: "var(--text-dim)", marginLeft: "auto" }}>{p.speed} · {p.fee}</span>
            </div>
            <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{p.note}</p>
          </div>
        ))}
      </div>

      <PageNav />
    </div>
  );
}
