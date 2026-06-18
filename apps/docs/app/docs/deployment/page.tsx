import type { Metadata } from "next";
import CodeBlock from "@/components/CodeBlock";
import Callout   from "@/components/Callout";
import PageNav   from "@/components/PageNav";

export const metadata: Metadata = { title: "Self-Hosting" };

function EnvRow({ name, required, children }: { name: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex gap-5 px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
      <div style={{ width: 260, flexShrink: 0 }}>
        <code style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "var(--lime)", background: "none", padding: 0, border: "none" }}>{name}</code>
        {required && (
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 9, color: "var(--gold)", background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.2)", padding: "1px 6px", borderRadius: 3, letterSpacing: "0.06em", marginLeft: 8 }}>REQ</span>
        )}
      </div>
      <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-muted)" }}>{children}</span>
    </div>
  );
}

export default function Deployment() {
  return (
    <div className="prose">
      <p className="mono-label">Developer</p>
      <h1>Self-Hosting</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
        Run Auron locally or deploy to Vercel. The main app lives at <code>apps/web</code>. The docs site at <code>apps/docs</code>.
      </p>
      <hr />

      <h2>Local setup</h2>
      <CodeBlock
        language="bash"
        code={`git clone https://github.com/anirudhh206/auron
cd auron/apps/web
npm install
cp .env.example .env.local
npm run dev`}
      />
      <p>The dev server starts at <code>http://localhost:3000</code>. With only the required env vars set, the app runs in <strong>demo mode</strong> — on-chain verification still runs against devnet, but the final INR payout is simulated.</p>

      <hr />

      <h2>Database setup</h2>
      <p>Auron uses Supabase (Postgres). Run the migrations in order in the Supabase SQL Editor:</p>
      <CodeBlock
        language="bash"
        code={`# Initial schema — transactions, settlements, status_history, contacts, api_keys
apps/web/lib/db/schema.sql

# Migration 001 — receipt hash + refund columns
apps/web/lib/db/migration_001_receipt_refund.sql`}
      />
      <Callout type="warn">
        Row-level security is enabled on all tables by default. Make sure you are using the <strong>service role key</strong> (<code>SUPABASE_SERVICE_ROLE_KEY</code>) in server-side routes — the anon key will fail most write operations.
      </Callout>

      <hr />

      <h2>Environment variables</h2>

      <h3>Required — basic functionality</h3>
      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        <EnvRow name="ANTHROPIC_API_KEY" required>Claude AI for intent parsing and chat. Get at console.anthropic.com.</EnvRow>
        <EnvRow name="NEXT_PUBLIC_SUPABASE_URL" required>Your Supabase project URL.</EnvRow>
        <EnvRow name="NEXT_PUBLIC_SUPABASE_ANON_KEY" required>Supabase anon key — safe for client-side use.</EnvRow>
        <EnvRow name="SUPABASE_SERVICE_ROLE_KEY" required>Service role key — server-side only. Never expose to client.</EnvRow>
        <div className="px-5 py-3">
          <code style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "var(--lime)", background: "none", padding: 0, border: "none" }}>NEXT_PUBLIC_SOLANA_NETWORK</code>
          <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-muted)", marginLeft: 20 }}>Set to <code>devnet</code> for development, <code>mainnet-beta</code> for production.</span>
        </div>
      </div>

      <h3>Required — real settlements</h3>
      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        <EnvRow name="RAZORPAY_KEY_ID" required>Razorpay API key ID. Use <code>rzp_test_xxx</code> for sandbox.</EnvRow>
        <EnvRow name="RAZORPAY_KEY_SECRET" required>Razorpay API secret. Server-side only.</EnvRow>
        <EnvRow name="RAZORPAY_ACCOUNT_ID">Razorpay X virtual account number. Required for real UPI payouts. Needs KYB.</EnvRow>
        <EnvRow name="ONMETA_API_KEY">OnMeta off-ramp API key. Primary settlement path. Requires OnMeta KYB (3–7 days).</EnvRow>
        <EnvRow name="ONMETA_WEBHOOK_SECRET">HMAC secret for OnMeta webhook verification. Without this, webhooks are unverified.</EnvRow>
        <div className="px-5 py-3">
          <code style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "var(--lime)", background: "none", padding: 0, border: "none" }}>TREASURY_KEYPAIR_BASE58</code>
          <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-muted)", marginLeft: 20 }}>Base58 private key of the treasury wallet. Required for auto-refunds. Never log or expose.</span>
        </div>
      </div>

      <h3>Infrastructure</h3>
      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        <EnvRow name="KV_URL">Vercel KV connection URL. Required for rate limiting. Degrades gracefully without it.</EnvRow>
        <EnvRow name="KV_REST_API_URL">Vercel KV REST API URL.</EnvRow>
        <EnvRow name="KV_REST_API_TOKEN">Vercel KV REST token.</EnvRow>
        <EnvRow name="SOLANA_RPC_URL">Helius or custom RPC. Defaults to public devnet if unset (slow).</EnvRow>
        <div className="px-5 py-3">
          <code style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "var(--lime)", background: "none", padding: 0, border: "none" }}>CRON_SECRET</code>
          <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-muted)", marginLeft: 20 }}>Bearer token for <code>/api/workers/*</code>. Without this, settlement and reconciliation workers are publicly callable.</span>
        </div>
      </div>

      <h3>Monitoring & security</h3>
      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        <EnvRow name="SENTRY_DSN">Sentry project DSN for error tracking.</EnvRow>
        <EnvRow name="NEXT_PUBLIC_SENTRY_DSN">Client-side Sentry DSN.</EnvRow>
        <div className="px-5 py-3">
          <code style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "var(--lime)", background: "none", padding: 0, border: "none" }}>NEXTAUTH_SECRET</code>
          <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-muted)", marginLeft: 20 }}>Session signing secret. Generate with: <code>openssl rand -hex 32</code></span>
        </div>
      </div>

      <h3>Feature flags</h3>
      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        <EnvRow name="DEMO_SETTLEMENT">Set <code>true</code> to skip real payout dispatch. On-chain verification still runs.</EnvRow>
        <EnvRow name="NEXT_PUBLIC_FULL_DEMO_MODE">Set <code>true</code> to skip on-chain TX entirely. For demos without Phantom.</EnvRow>
        <div className="px-5 py-3">
          <code style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "var(--lime)", background: "none", padding: 0, border: "none" }}>NEXT_PUBLIC_ENABLE_VOICE_INPUT</code>
          <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-muted)", marginLeft: 20 }}>Set <code>true</code> to enable Web Speech API voice input in the chat interface (Chrome only).</span>
        </div>
      </div>

      <hr />

      <h2>Vercel deployment</h2>
      <CodeBlock
        language="bash"
        code={`# Deploy the main app
cd apps/web
vercel --prod

# Deploy the docs (separate Vercel project)
cd apps/docs
vercel --prod`}
      />
      <p>Configure Vercel Cron in <code>vercel.json</code> for the settlement and reconciliation workers:</p>
      <CodeBlock
        language="json"
        filename="apps/web/vercel.json"
        code={`{
  "crons": [
    {
      "path": "/api/workers/settlement",
      "schedule": "*/30 * * * * *"
    },
    {
      "path": "/api/workers/reconcile",
      "schedule": "0 2 * * *"
    }
  ]
}`}
      />
      <Callout type="info">
        The settlement worker runs every 30 seconds to retry failed settlements. The reconciliation worker runs daily at 02:00 UTC to fix stuck payments and detect provider mismatches.
      </Callout>

      <hr />

      <h2>Live activation — OnMeta</h2>
      <p>OnMeta is a FIU-registered crypto off-ramp under India&apos;s VDA framework. KYB is required for production settlements.</p>
      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {[
          ["Apply at onmeta.in/business",            "Submit: Certificate of Incorporation, Director Aadhaar + PAN, bank account proof"],
          ["Compliance review",                       "3–7 business days for KYB approval"],
          ["Set ONMETA_API_KEY + ONMETA_WEBHOOK_SECRET", "Add to Vercel environment variables"],
          ["Register webhook URL",                    "Set https://your-domain.com/api/webhooks/onmeta in OnMeta dashboard"],
        ].map(([step, desc], i, arr) => (
          <div key={step} className="flex gap-4 px-5 py-4" style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 18, fontWeight: 300, color: "var(--border-bright)", width: 28, flexShrink: 0, lineHeight: 1.3 }}>{String(i + 1).padStart(2, "0")}</span>
            <div>
              <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 13, color: "var(--text)", margin: "0 0 4px" }}>{step}</p>
              <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{desc}</p>
            </div>
          </div>
        ))}
      </div>

      <PageNav />
    </div>
  );
}
