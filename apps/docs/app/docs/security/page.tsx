import type { Metadata } from "next";
import CodeBlock from "@/components/CodeBlock";
import Callout   from "@/components/Callout";
import PageNav   from "@/components/PageNav";

export const metadata: Metadata = { title: "Security" };

function Layer({ n, title, tag, children }: { n: number; title: string; tag: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-5 mb-0">
      <div className="flex flex-col items-center flex-shrink-0">
        <span
          style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: 28,
            fontWeight: 300,
            color: "var(--border-bright)",
            lineHeight: 1,
            width: 40,
            textAlign: "right",
            flexShrink: 0,
          }}
        >
          {String(n).padStart(2, "0")}
        </span>
        <div style={{ width: 1, flex: 1, background: "var(--border)", marginTop: 8, minHeight: 28 }} />
      </div>
      <div style={{ paddingBottom: 32, paddingLeft: 16, flex: 1 }}>
        <div className="flex items-center gap-3 mb-2 mt-0.5">
          <span style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 15, color: "var(--text)" }}>
            {title}
          </span>
          <span
            style={{
              fontFamily: "'Geist Mono', monospace",
              fontSize: 10,
              color: "var(--lime)",
              background: "var(--lime-glow)",
              border: "1px solid var(--lime-border)",
              padding: "2px 8px",
              borderRadius: 4,
              letterSpacing: "0.06em",
            }}
          >
            {tag}
          </span>
        </div>
        <div style={{ fontSize: "0.9rem", color: "var(--text-muted)", lineHeight: 1.75 }}>{children}</div>
      </div>
    </div>
  );
}

export default function Security() {
  return (
    <div className="prose">
      <p className="mono-label">Security</p>
      <h1>Security Model</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
        Every payment passes through six independent verification layers before any settlement action. A failure at any layer halts the payment — no partial settlements, no silent failures.
      </p>
      <hr />

      <h2>The 6-layer verification model</h2>

      <div style={{ marginTop: 24, marginBottom: 8 }}>
        <Layer n={1} title="On-chain confirmation" tag="Solana RPC">
          <p>The transaction signature is fetched from a Solana RPC node and checked for <code>confirmed</code> or <code>finalized</code> status. If not yet propagated, Auron retries up to <strong style={{ color: "var(--text)" }}>4 times (12 s total)</strong> before failing.</p>
        </Layer>
        <Layer n={2} title="USDC mint validation" tag="SPL Token">
          <p>Every transfer instruction is checked against the canonical USDC mint address — mainnet <code>EPjFWdd5…</code> or devnet <code>Gh9ZwEmd…</code>. Fake tokens that mimic USDC are rejected here.</p>
        </Layer>
        <Layer n={3} title="Treasury ATA destination" tag="Address check">
          <p>The destination ATA is derived on-the-fly from the treasury wallet and USDC mint. The transfer must target this exact address. On mainnet this is a hard failure; on devnet it logs a warning and proceeds.</p>
        </Layer>
        <Layer n={4} title="Amount tolerance check" tag="2% tolerance">
          <p>The on-chain USDC amount must match the quoted amount within <strong style={{ color: "var(--text)" }}>±2%</strong>. This covers rounding differences across wallets while blocking payments that are significantly short.</p>
        </Layer>
        <Layer n={5} title="Idempotency guard" tag="Vercel KV">
          <p>Transaction signatures are stored in Vercel KV after the first successful settlement. Any attempt to re-submit the same signature returns <strong>HTTP 409</strong> instead of triggering a duplicate payout.</p>
        </Layer>
        <Layer n={6} title="IP rate limiting" tag="Vercel KV">
          <p>Each IP is limited to 10 payment attempts per minute. API key holders have higher per-key limits configured in the database. Human wallet users share the IP-based bucket.</p>
        </Layer>
      </div>

      <Callout type="warn">
        All 6 checks are hard failures on <strong>mainnet-beta</strong>. The only warn-only behaviour (Layer 3 treasury ATA check) is gated on <code>NEXT_PUBLIC_SOLANA_NETWORK !== &quot;mainnet-beta&quot;</code>.
      </Callout>

      <hr />

      <h2 id="rate-limit">Rate limits by endpoint</h2>
      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {[
          ["POST /api/v1/pay",       "10 / min per IP · 100 / min per API key"],
          ["GET  /api/quote",         "60 / min per IP"],
          ["GET  /api/rate",          "120 / min per IP"],
          ["POST /api/hash-pin",      "5 / min per IP"],
          ["POST /api/parse-intent",  "20 / min per user"],
          ["POST /api/chat",          "20 / min per user"],
        ].map(([route, limit], i, arr) => (
          <div
            key={route}
            className="flex gap-8 px-5 py-3"
            style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}
          >
            <code style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "#60a5fa", background: "none", padding: 0, border: "none", width: 200, flexShrink: 0 }}>
              {route}
            </code>
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-muted)" }}>{limit}</span>
          </div>
        ))}
      </div>
      <p>When a limit is exceeded, Auron returns <code>429 Too Many Requests</code> with a <code>Retry-After</code> header indicating when the window resets.</p>

      <hr />

      <h2 id="verify">Transaction verifier internals</h2>
      <p>
        The verifier inspects both top-level and inner instructions from the parsed transaction. This matters because Phantom routes USDC transfers through the Associated Token Program via CPI — the actual SPL transfer often appears only in <code>innerInstructions</code>.
      </p>
      <CodeBlock
        language="ts"
        code={`// Both top-level AND inner instructions are inspected
const topLevel = tx.transaction.message.instructions;
const inner    = tx.meta?.innerInstructions?.flatMap(i => i.instructions) ?? [];
const all      = [...topLevel, ...inner];

// Both transfer types are accepted
if (parsed.type !== "transferChecked" && parsed.type !== "transfer") continue;

// For transferChecked: verify USDC mint
if (parsed.type === "transferChecked") {
  if ((info.mint as string) !== usdcMint) continue;
}`}
      />

      <Callout type="warn">
        Never call <code>/api/v1/pay</code> before waiting for on-chain confirmation. Pass <code>commitment: &quot;confirmed&quot;</code> to <code>confirmTransaction</code> first — the verifier will retry but you burn 12 s before it fails.
      </Callout>

      <h2>PIN security</h2>
      <p>
        User PINs are hashed with <strong>argon2id</strong> on the server via <code>/api/hash-pin</code>. The raw PIN never leaves the browser in plaintext. PIN hashes are excluded from <code>localStorage</code> persistence in the Zustand store via <code>partialize</code>.
      </p>

      <h2>API key storage</h2>
      <p>
        API keys are stored as <strong>SHA-256 hashes</strong> only. Auron never logs, stores, or transmits raw key values. To revoke a key, set <code>is_active = false</code> in the <code>api_keys</code> table — the hash becomes inactive immediately with no cache invalidation delay.
      </p>

      <Callout type="danger">
        Never embed <code>ak_live_xxx</code> keys in client-side code or commit them to version control. Use <code>process.env.AURON_API_KEY</code> on your server only. A compromised live key can initiate payouts up to your daily spend limit.
      </Callout>

      <h2>Transport security</h2>
      <ul>
        <li>All traffic is TLS 1.2+ (enforced by Vercel edge)</li>
        <li><code>Content-Security-Policy</code> set to <code>default-src &apos;self&apos;</code> with explicit allowlists</li>
        <li><code>X-Frame-Options: DENY</code> — prevents clickjacking</li>
        <li><code>X-Content-Type-Options: nosniff</code></li>
        <li><code>Referrer-Policy: strict-origin-when-cross-origin</code></li>
      </ul>

      <h2>Responsible disclosure</h2>
      <p>Found a vulnerability? Email <code>anirudhvashisth2006@gmail.com</code> before public disclosure. We aim to acknowledge within 24 hours and resolve within 14 days for critical issues.</p>

      <PageNav />
    </div>
  );
}
