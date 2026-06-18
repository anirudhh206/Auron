import type { Metadata } from "next";
import Callout from "@/components/Callout";
import PageNav from "@/components/PageNav";

export const metadata: Metadata = { title: "Vision & Roadmap" };

function Phase({ n, title, status, children }: { n: string; title: string; status: "live" | "building" | "planned"; children: React.ReactNode }) {
  const s = {
    live:     { color: "var(--lime)",   bg: "var(--lime-glow)",             border: "var(--lime-border)",             label: "CURRENT" },
    building: { color: "var(--gold)",   bg: "rgba(245,166,35,0.08)",        border: "rgba(245,166,35,0.2)",           label: "NEXT"    },
    planned:  { color: "var(--text-dim)", bg: "transparent",                border: "var(--border)",                  label: "ROADMAP" },
  }[status];

  return (
    <div style={{ border: `1px solid ${s.border}`, background: s.bg, borderRadius: 12, padding: "28px 28px 24px", marginBottom: 16 }}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "var(--text-dim)", letterSpacing: "0.08em" }}>PHASE {n}</span>
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: s.color, background: s.bg, border: `1px solid ${s.border}`, padding: "2px 8px", borderRadius: 4, letterSpacing: "0.06em" }}>{s.label}</span>
        </div>
      </div>
      <h3 style={{ fontFamily: "'Instrument Serif', serif", fontWeight: 400, fontSize: "1.25rem", color: "var(--text)", margin: "0 0 12px" }}>{title}</h3>
      <div style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.75 }}>{children}</div>
    </div>
  );
}

export default function Vision() {
  return (
    <div className="prose">
      <p className="mono-label">Overview</p>
      <h1>Vision & Roadmap</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
        Auron is not a crypto payment app. The goal is to become the infrastructure layer that allows any digital asset to move, convert, settle, and operate across any currency, network, and financial system.
      </p>
      <hr />

      <h2>The infrastructure gap</h2>
      <p>
        India&apos;s UPI network processes ₹20 trillion per month across 350 million users. Stablecoins settle trillions of dollars in annual volume globally. Between them: nothing.
      </p>
      <p>
        No programmable settlement layer. No treasury primitives. No cross-border coordination logic. No lifecycle management above the transaction level.
      </p>
      <p>
        Every attempt to bridge them produces the same result: a wrapper around a single rail that breaks at the coordination boundary. The gap is not in the rails. It is in the layer above them — the layer that manages state, routes between providers, verifies on-chain, tracks settlement, and recovers from failure automatically.
      </p>

      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, padding: "20px 24px", margin: "24px 0", fontFamily: "'Geist Mono', monospace", fontSize: 13 }}>
        <div style={{ color: "var(--text-dim)", fontSize: 10, letterSpacing: "0.1em", marginBottom: 12 }}>CURRENT FINANCIAL SYSTEM</div>
        {["Bank", "Correspondent bank", "SWIFT", "Currency conversion", "Receiver bank"].map((step, i) => (
          <div key={step} className="flex items-center gap-3">
            <span style={{ color: "var(--text-muted)" }}>{step}</span>
            {i < 4 && <div style={{ width: 1, height: 16, background: "var(--border)", margin: "2px 0 2px 40px", position: "absolute" }} />}
          </div>
        ))}
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)", color: "var(--text-dim)", fontSize: 11 }}>
          Slow · Expensive · Fragmented · Cannot integrate with AI systems
        </div>
      </div>

      <div style={{ background: "var(--lime-glow)", border: "1px solid var(--lime-border)", borderRadius: 10, padding: "20px 24px", margin: "24px 0", fontFamily: "'Geist Mono', monospace", fontSize: 13 }}>
        <div style={{ color: "var(--lime)", fontSize: 10, letterSpacing: "0.1em", marginBottom: 12 }}>AURON</div>
        {[["Any Asset", "var(--text-muted)"], ["Auron Intelligence Layer", "var(--lime)"], ["Any Local Currency", "var(--text-muted)"]].map(([label, color]) => (
          <div key={label} style={{ color, marginBottom: 4 }}>{label}</div>
        ))}
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--lime-border)", color: "var(--text-dim)", fontSize: 11 }}>
          Seconds · Programmable · Verifiable · AI-native
        </div>
      </div>

      <hr />

      <h2>What Auron is not</h2>
      <p style={{ color: "var(--text-muted)" }}>
        These are limited categories. Building any of them would cap Auron&apos;s ceiling.
      </p>
      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {["Another crypto wallet", "Another exchange", "Another checkout app", "Another payment link company", "Another crypto card"].map((item, i, arr) => (
          <div key={item} className="flex items-center gap-3 px-5 py-3" style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 12, color: "#EF4444" }}>✕</span>
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-muted)" }}>{item}</span>
          </div>
        ))}
      </div>

      <hr />

      <h2>The 4-phase roadmap</h2>

      <Phase n="1" title="Settlement Infrastructure" status="live">
        <p style={{ margin: "0 0 12px" }}>The foundation. Every primitive required for production-grade stablecoin settlement — live today on Solana devnet.</p>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>Programmable payment intent layer — Claude AI parses natural language</li>
          <li>7-step on-chain verification engine — hard gate before any settlement</li>
          <li>Internal ledger with full lifecycle management (14-state machine)</li>
          <li>Queue-based settlement orchestration with retry + auto-recovery</li>
          <li>Failure classification + auto-refund engine</li>
          <li>Price guard, quote expiry, liquidity gates</li>
          <li>Replayable SHA-256 receipts with cryptographic audit trail</li>
          <li>Time-locked Anchor vault program</li>
          <li>Solana Blinks — composable pay links inside X/Twitter</li>
        </ul>
      </Phase>

      <Phase n="2" title="Treasury Primitives" status="building">
        <p style={{ margin: "0 0 12px" }}>Turning Auron from a payment processor into a treasury coordination layer for businesses.</p>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>Merchant settlement APIs — batch payouts, scheduled transfers</li>
          <li>Programmable payment splits and escrow</li>
          <li>Developer SDK with full TypeScript types</li>
          <li>Webhooks + event streaming</li>
          <li>Multi-currency support (USDT, USDC, EURC)</li>
          <li>Expanded liquidity provider routing (Transak, Stripe)</li>
          <li>INR float treasury management</li>
        </ul>
      </Phase>

      <Phase n="3" title="AI-Native Financial Orchestration" status="planned">
        <p style={{ margin: "0 0 12px" }}>The layer that makes Auron infrastructure-grade — machines transacting with machines.</p>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>AI agent payment APIs — machine-readable settlement primitives</li>
          <li>Autonomous treasury balancing via AI-managed liquidity routing</li>
          <li>Conditional payment workflows — programmable escrow, milestone releases</li>
          <li>Cross-network abstraction — Solana, Ethereum, Base, Starknet, one interface</li>
          <li>Programmable collateral and yield — treasury-backed financial products</li>
          <li>Sub-account architecture for isolated business treasury environments</li>
        </ul>
      </Phase>

      <Phase n="4" title="Sovereign Infrastructure" status="planned">
        <p style={{ margin: "0 0 12px" }}>Where Auron becomes an independent financial coordination network — the operating system for programmable money.</p>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li>Multi-rail settlement — SWIFT, Stellar, Lightning, ACH, SEPA</li>
          <li>Intelligent liquidity routing across rails and networks</li>
          <li>RWA coordination — invoice liquidity, merchant receivables, credit markets</li>
          <li>B2B settlement network — exchanges, payroll, gaming, SaaS billing</li>
          <li>Global expansion — Southeast Asia, MENA, LATAM corridors</li>
          <li>Regulatory framework — VDA reporting, FEMA, licensed operations</li>
        </ul>
      </Phase>

      <hr />

      <h2>Positioning</h2>
      <p>Auron sits at the intersection of global money movement (Wise), payment networks (Visa), developer infrastructure (Stripe), stablecoin infrastructure (Circle), and AI agents. The goal is not to copy any of them — it is to combine Payments + Stablecoins + AI + RWA + Liquidity into one programmable financial infrastructure layer.</p>

      <Callout type="tip">
        The vision is massive. The execution starts narrow: the fastest and easiest way to convert any crypto asset into usable local currency anywhere — then expand upward from there.
      </Callout>

      <PageNav />
    </div>
  );
}
