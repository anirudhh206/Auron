import type { Metadata } from "next";
import Callout from "@/components/Callout";
import PageNav from "@/components/PageNav";

export const metadata: Metadata = { title: "Business Model" };

export default function BusinessModel() {
  return (
    <div className="prose">
      <p className="mono-label">Company</p>
      <h1>Business Model</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
        Auron earns from every payment it settles. No subscription required. No upfront cost. The business model is built into the protocol from transaction one.
      </p>
      <hr />

      <h2>Primary revenue — FX spread</h2>
      <p>
        Every USDC → INR settlement passes through Auron&apos;s quote engine, which applies a <strong style={{ color: "var(--text)" }}>0.85% spread</strong> to the live CoinGecko market rate.
      </p>

      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, padding: "20px 24px", fontFamily: "'Geist Mono', monospace", fontSize: 12, lineHeight: 2.2 }}>
        <div style={{ color: "var(--text-dim)", fontSize: 10, letterSpacing: "0.1em", marginBottom: 8 }}>EXAMPLE · ₹500 PAYMENT</div>
        <div style={{ color: "var(--text-muted)" }}>Market rate (CoinGecko)    <span style={{ color: "var(--text)", float: "right" }}>₹84.79 / USDC</span></div>
        <div style={{ color: "var(--text-muted)" }}>Auron rate (0.85% spread)  <span style={{ color: "var(--text)", float: "right" }}>₹84.07 / USDC</span></div>
        <div style={{ color: "var(--text-muted)" }}>User sends                 <span style={{ color: "var(--text)", float: "right" }}>5.94 USDC</span></div>
        <div style={{ color: "var(--text-muted)" }}>OnMeta uses for ₹500       <span style={{ color: "var(--lime)", float: "right" }}>5.90 USDC</span></div>
        <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 8, color: "var(--text-muted)" }}>
          Auron retains                <span style={{ color: "var(--lime)", float: "right" }}>~0.04 USDC (~₹3.60)</span>
        </div>
        <div style={{ color: "var(--text-dim)", fontSize: 11, marginTop: 4 }}>
          This accumulates in the treasury automatically — no invoicing, no manual collection.
        </div>
      </div>

      <Callout type="tip">
        The treasury is self-filling. Spread revenue accumulates in the Auron treasury wallet with every transaction — 0.82 USDC has already been earned from 29 devnet payments.
      </Callout>

      <hr />

      <h2>Unit economics</h2>

      <h3>Per transaction</h3>
      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {[
          ["₹100 payment",    "₹1.00 gross",   "₹0.50 OnMeta fee",  "₹0.50 net"],
          ["₹500 payment",    "₹5.02 gross",   "₹2.50 OnMeta fee",  "₹2.52 net"],
          ["₹2,000 payment",  "₹20.10 gross",  "₹10.00 OnMeta fee", "₹10.10 net"],
          ["₹10,000 payment", "₹100.50 gross", "₹50.00 OnMeta fee", "₹50.50 net"],
        ].map(([size, gross, fee, net], i, arr) => (
          <div key={size} className="flex gap-4 px-5 py-3" style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}>
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-muted)", width: 130, flexShrink: 0 }}>{size}</span>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "var(--text-dim)", width: 120, flexShrink: 0 }}>{gross}</span>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "var(--text-dim)", width: 140, flexShrink: 0 }}>−{fee}</span>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "var(--lime)", fontWeight: 600 }}>{net}</span>
          </div>
        ))}
      </div>

      <h3>At scale — 10,000 transactions/day · avg ₹400</h3>
      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {[
          ["FX spread (0.85%)",   "₹34,000 / day",  "₹12.4M / year"],
          ["OnMeta fees (~0.5%)", "−₹20,000 / day", "−₹7.3M / year"],
          ["Net revenue",         "₹14,000 / day",  "₹5.1M / year (~$61K USD)"],
        ].map(([source, daily, annual], i, arr) => {
          const isNet = source === "Net revenue";
          return (
            <div key={source} className="flex gap-4 px-5 py-3" style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}>
              <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: isNet ? "var(--text)" : "var(--text-muted)", fontWeight: isNet ? 500 : 400, flex: 1 }}>{source}</span>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: isNet ? "var(--lime)" : "var(--text-dim)", width: 130, flexShrink: 0 }}>{daily}</span>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: isNet ? "var(--lime)" : "var(--text-dim)", width: 160, flexShrink: 0 }}>{annual}</span>
            </div>
          );
        })}
      </div>

      <hr />

      <h2>Revenue streams by phase</h2>

      <h3>Phase 1 — FX spread (live now)</h3>
      <p>0.85% applied to every USDC → INR conversion. Self-accruing into the treasury wallet. No code changes needed to earn it — it is built into the quote engine.</p>

      <h3>Phase 2 — API licensing + treasury management</h3>
      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {[
          ["Developer API (starter)",    "Free · 500 settlements/month · community support"],
          ["Developer API (growth)",     "₹4,999/month · 10,000 settlements · webhooks + analytics"],
          ["Enterprise API",             "Custom pricing · SLA · dedicated support · higher rate limits"],
          ["Treasury management fee",    "0.1–0.3% on idle stablecoin balances managed by Auron"],
        ].map(([tier, desc], i, arr) => (
          <div key={tier} className="px-5 py-3" style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}>
            <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 13, color: "var(--text)", margin: "0 0 3px" }}>{tier}</p>
            <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{desc}</p>
          </div>
        ))}
      </div>

      <h3>Phase 3 — AI agent infrastructure</h3>
      <p>Flat fee per agent-initiated transaction on top of the spread. Agents that process high volume qualify for volume discounts in exchange for minimum monthly commitments. Businesses pay for the reliability guarantee, not the transaction itself.</p>

      <h3>Phase 4 — Liquidity network</h3>
      <p>Auron becomes a marketplace connecting merchants needing liquidity with investors providing it. Revenue from: matching fees, yield management, invoice financing spreads, and cross-border corridor fees.</p>

      <hr />

      <h2>Cost structure</h2>
      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {[
          ["Anthropic API",     "~$60/month at 1,000 users (90% savings via prompt caching)"],
          ["Vercel hosting",    "~$20/month (Pro plan — includes Cron, KV, Edge)"],
          ["Supabase",          "~$25/month (Pro plan — enough for 10K payments/day)"],
          ["Helius RPC",        "~$50/month (dedicated Solana RPC — faster than public endpoints)"],
          ["OnMeta fee",        "~0.5% per transaction — variable, scales with revenue"],
          ["Solana fees",       "~$0.00025 per transaction — effectively zero"],
        ].map(([item, cost], i, arr) => (
          <div key={item} className="flex gap-5 px-5 py-3" style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}>
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-muted)", width: 160, flexShrink: 0 }}>{item}</span>
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-dim)" }}>{cost}</span>
          </div>
        ))}
      </div>
      <p style={{ color: "var(--text-muted)" }}>Fixed infrastructure costs are ~$155/month at 1,000 users — less than a single enterprise customer&apos;s monthly API fee.</p>

      <hr />

      <h2>Competitive positioning</h2>
      <p>No direct competitor does all of this:</p>
      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {[
          ["Wise",     "Fiat-to-fiat only. No stablecoin rails. No AI. No programmable routing."],
          ["Stripe",   "No crypto settlement. No on-chain verification. No Solana."],
          ["Razorpay", "India-native but fiat-only. No stablecoin input. No AI layer."],
          ["Circle",   "Stablecoin infrastructure but no last-mile UPI settlement."],
          ["Transak",  "On/off ramp only. No payment routing, no ledger, no AI."],
        ].map(([co, gap], i, arr) => (
          <div key={co} className="flex gap-5 px-5 py-3" style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}>
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text)", fontWeight: 500, width: 90, flexShrink: 0 }}>{co}</span>
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-muted)" }}>{gap}</span>
          </div>
        ))}
      </div>

      <PageNav />
    </div>
  );
}
