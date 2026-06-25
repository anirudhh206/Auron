import type { Metadata } from "next";
import Callout from "@/components/docs/Callout";
import PageNav from "@/components/docs/PageNav";

export const metadata: Metadata = { title: "Compliance Framework" };

export default function Compliance() {
  return (
    <div className="prose">
      <p className="mono-label">Company</p>
      <h1>Compliance Framework</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
        Auron never custodies INR. Fiat settlement executes exclusively through licensed partners. This document explains Auron&apos;s regulatory posture, obligations, and what each party is responsible for.
      </p>

      <Callout type="info">
        Auron&apos;s licensed settlement partners — OnMeta (FIU-registered) and Razorpay X (RBI-licensed) — handle the regulated fiat leg. Auron&apos;s role is verification, routing, state, and proof.
      </Callout>

      <hr />

      <h2>Regulatory coverage by layer</h2>
      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {[
          { layer: "USDC transfer (Solana)", entity: "User + Phantom",   coverage: "User self-custodies until the moment of transfer. Phantom is the licensed wallet. Auron receives USDC only after voluntary on-chain transfer." },
          { layer: "INR conversion",         entity: "OnMeta",           coverage: "FIU-registered crypto off-ramp. Files VDA transaction reports with Indian tax authorities. Handles AML/KYC on the fiat leg under RBI framework." },
          { layer: "UPI payout",             entity: "Razorpay X",       coverage: "RBI-licensed payments platform. Handles UPI transfer, payout ledger, and FEMA-compliant FX conversion as fallback." },
          { layer: "Settlement state",       entity: "Auron",            coverage: "Maintains audit trail, enforces spend limits, verifies on-chain proof, and stores cryptographic receipts. Does not touch fiat." },
        ].map((r, i, arr) => (
          <div key={r.layer} className="px-5 py-4" style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}>
            <div className="flex items-center gap-3 mb-2">
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "var(--lime)" }}>{r.layer}</span>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: "var(--text-dim)", background: "var(--surface)", border: "1px solid var(--border)", padding: "2px 8px", borderRadius: 4, letterSpacing: "0.06em" }}>{r.entity}</span>
            </div>
            <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{r.coverage}</p>
          </div>
        ))}
      </div>

      <hr />

      <h2>KYC (Know Your Customer)</h2>
      <p>
        Auron&apos;s KYC obligation is to verify the identity of users who initiate settlements above regulatory thresholds. The system is built but gated — KYC is enforced at the middleware level via Supabase session check, with status tracked in the <code>kyc</code> table.
      </p>

      <h3>KYC tiers</h3>
      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {[
          { tier: "Tier 0 — Unverified",   limit: "₹10,000 / month",   required: "Wallet connect only" },
          { tier: "Tier 1 — Basic",        limit: "₹1,00,000 / month",  required: "PAN card + selfie" },
          { tier: "Tier 2 — Full",         limit: "₹10,00,000 / month", required: "Aadhaar + PAN + bank proof" },
        ].map((t, i, arr) => (
          <div key={t.tier} className="flex gap-4 px-5 py-3" style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}>
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text)", fontWeight: 500, width: 200, flexShrink: 0 }}>{t.tier}</span>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "var(--lime)", width: 160, flexShrink: 0 }}>{t.limit}</span>
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-muted)" }}>{t.required}</span>
          </div>
        ))}
      </div>
      <p>KYC verification is handled through a provider-agnostic integration layer (<code>lib/kyc.ts</code>). Sumsub is the default provider. The middleware checks KYC status on every payment initiation — not just at signup.</p>

      <hr />

      <h2>AML (Anti-Money Laundering)</h2>
      <p>Auron operates three AML controls:</p>

      <div style={{ marginTop: 16, marginBottom: 28 }}>
        {[
          { n: "01", title: "Transaction monitoring", body: "All payments are screened against velocity rules: >10 transactions in an hour, duplicate payments within 60 seconds, amounts that spike significantly above a user's historical average. Flagged payments route to the risk scoring engine (0–100 score) before any settlement proceeds." },
          { n: "02", title: "Spend limits", body: "Per-transaction cap (₹2,00,000 / 2,500 USDC) and daily cap (₹5,00,000 / 5,000 USDC) are enforced server-side. User-configured ceilings can only be lower, not higher, than these limits. API key holders have per-key daily limits set in the database." },
          { n: "03", title: "Licensed partner screening", body: "OnMeta performs wallet screening and sanctions checks on the fiat leg as part of their FIU registration obligations. Razorpay X screens UPI IDs against RBI blacklists. Auron does not duplicate this — we rely on partner coverage for the fiat settlement layer." },
        ].map((s, i) => (
          <div key={s.n} className="flex gap-5 mb-0">
            <div className="flex flex-col items-center flex-shrink-0">
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 28, fontWeight: 300, color: "var(--border-bright)", lineHeight: 1, width: 40, textAlign: "right" }}>{s.n}</span>
              {i < 2 && <div style={{ width: 1, flex: 1, background: "var(--border)", marginTop: 8, minHeight: 28 }} />}
            </div>
            <div style={{ paddingBottom: i < 2 ? 28 : 0, paddingLeft: 16, flex: 1, paddingTop: 2 }}>
              <span style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 15, color: "var(--text)", display: "block", marginBottom: 6 }}>{s.title}</span>
              <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", lineHeight: 1.75, margin: 0 }}>{s.body}</p>
            </div>
          </div>
        ))}
      </div>

      <hr />

      <h2>Data retention</h2>
      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {[
          ["Transaction records",       "7 years",          "RBI requirement for payment records"],
          ["Status history (audit log)", "7 years",          "Append-only — never deleted or modified"],
          ["KYC documents",             "5 years post-offboarding", "PMLA / VDA reporting requirement"],
          ["Chat messages",             "90 days",          "Operational debugging only, then purged"],
          ["IP addresses (rate limit)", "60 seconds",       "KV TTL — not persisted to database"],
          ["PIN hash",                  "Until user deletes account", "argon2id hash only — raw PIN never stored"],
        ].map(([data, retention, reason], i, arr) => (
          <div key={data} className="px-5 py-3" style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}>
            <div className="flex items-baseline gap-3 mb-1">
              <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text)", fontWeight: 500, flex: 1 }}>{data}</span>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "var(--lime)", flexShrink: 0 }}>{retention}</span>
            </div>
            <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 12, color: "var(--text-dim)", margin: 0 }}>{reason}</p>
          </div>
        ))}
      </div>

      <hr />

      <h2>Audit logs</h2>
      <p>
        Every payment has an immutable audit trail in the <code>status_history</code> table. The trail is append-only — rows are never updated or deleted, enforced at the database level via row-level security policy. Cryptographic receipts (<code>GET /api/receipt/:id</code>) are permanently accessible to payers and payees without authentication.
      </p>
      <p>The receipt hash (SHA-256 of canonical fields) allows independent verification that Auron&apos;s records have not been altered after the fact — a tamper-evident log that does not rely on trusting Auron&apos;s database.</p>

      <hr />

      <h2>VDA reporting (India)</h2>
      <p>
        Under India&apos;s Prevention of Money Laundering Act (PMLA) amendment (2023), VDA (Virtual Digital Asset) service providers must report transactions above threshold to the Financial Intelligence Unit (FIU-IND). This obligation is covered by <strong style={{ color: "var(--text)" }}>OnMeta</strong>, which holds FIU registration and files reports on Auron&apos;s behalf for all settlements that flow through their system.
      </p>
      <p>
        Auron&apos;s obligation: maintain user KYC records, enforce spend limits, and provide transaction data to OnMeta on request. All of these are implemented.
      </p>

      <hr />

      <h2>Incident response</h2>
      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {[
          { severity: "P0 — Funds at risk",       sla: "< 15 min",   action: "Pause all new settlements immediately. Trigger auto-refunds for in-flight payments. Notify users." },
          { severity: "P1 — Settlement failure",   sla: "< 1 hour",   action: "Auto-recovery kicks in (worker retry + provider switch). Manual escalation if auto-recovery fails after 3 attempts." },
          { severity: "P2 — Data incident",        sla: "< 4 hours",  action: "Isolate affected records. Notify impacted users within 72 hours per DPDP Act requirements." },
          { severity: "P3 — Degraded service",     sla: "< 24 hours", action: "Status page update. Root cause analysis. Post-mortem within 7 days." },
        ].map((r, i, arr) => (
          <div key={r.severity} className="px-5 py-4" style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}>
            <div className="flex items-center gap-3 mb-2">
              <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text)", fontWeight: 500 }}>{r.severity}</span>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: "var(--gold)", background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.2)", padding: "2px 8px", borderRadius: 4, letterSpacing: "0.06em", marginLeft: "auto" }}>SLA {r.sla}</span>
            </div>
            <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{r.action}</p>
          </div>
        ))}
      </div>

      <Callout type="danger">
        Disclosure of a security vulnerability involving user funds must be treated as P0 regardless of whether exploitation has occurred. Contact <code>anirudhvashisth2006@gmail.com</code> for responsible disclosure.
      </Callout>

      <PageNav />
    </div>
  );
}
