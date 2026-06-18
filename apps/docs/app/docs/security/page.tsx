import type { Metadata } from "next";
import CodeBlock from "@/components/CodeBlock";
import Callout   from "@/components/Callout";
import PageNav   from "@/components/PageNav";

export const metadata: Metadata = { title: "Security" };

function Layer({ n, title, tag, children }: { n: number; title: string; tag: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 px-5 py-5 border-b" style={{ borderColor: "var(--border)" }}>
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5"
        style={{ background: "var(--accent)", color: "#fff" }}
      >
        {n}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-1.5">
          <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>{title}</span>
          <span
            className="text-[10px] uppercase px-1.5 py-0.5 rounded font-medium"
            style={{ background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)", letterSpacing: "0.06em" }}
          >
            {tag}
          </span>
        </div>
        <div className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{children}</div>
      </div>
    </div>
  );
}

export default function Security() {
  return (
    <div className="prose">
      <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "var(--text-subtle)", letterSpacing: "0.1em" }}>
        Security
      </p>
      <h1>Security Model</h1>
      <p style={{ color: "var(--text-muted)" }}>
        Every payment passes through six independent verification layers before any settlement action. A failure at any layer halts the payment — no partial settlements, no silent failures.
      </p>

      <hr />

      <h2>The 6-layer verification model</h2>
      <div style={{ border: "1px solid var(--border)", borderRadius: "6px", overflow: "hidden" }}>
        <Layer n={1} title="On-chain confirmation" tag="Solana RPC">
          The transaction signature is fetched from a Solana RPC node and checked for <code>confirmed</code> or <code>finalized</code> status. If not yet propagated, Auron retries up to <strong style={{ color: "var(--text)" }}>4 times (12 s total)</strong> before failing.
        </Layer>
        <Layer n={2} title="USDC mint validation" tag="Token check">
          Every transfer instruction is checked against the canonical USDC mint address — mainnet <code>EPjFWdd5…</code> or devnet <code>Gh9ZwEmd…</code>. Fake tokens that mimic USDC are rejected here.
        </Layer>
        <Layer n={3} title="Treasury ATA destination" tag="Address check">
          The destination ATA is derived on-the-fly from the treasury wallet and USDC mint. The transfer must target this exact address. On mainnet this is a hard failure; on devnet it logs a warning and proceeds.
        </Layer>
        <Layer n={4} title="Amount tolerance check" tag="Math">
          The on-chain USDC amount must match the quoted amount within <strong style={{ color: "var(--text)" }}>2% tolerance</strong>. This covers rounding differences across wallets while blocking payments that are significantly short.
        </Layer>
        <Layer n={5} title="Idempotency guard" tag="Vercel KV">
          Transaction signatures are stored in Vercel KV after the first successful settlement. Any attempt to re-submit the same signature returns <code>409</code> instead of triggering a duplicate payout.
        </Layer>
        <Layer n={6} title="IP rate limiting" tag="Vercel KV">
          Each IP is limited to 10 payment attempts per minute. API key holders have higher per-key limits configured in the database. Human wallet users share the IP-based bucket.
        </Layer>
      </div>

      <h2 id="rate-limit">Rate limits by endpoint</h2>
      <div style={{ border: "1px solid var(--border)", borderRadius: "6px", overflow: "hidden" }}>
        {[
          ["POST /api/v1/pay",       "10 / min per IP · 100 / min per API key"],
          ["GET /api/quote",         "60 / min per IP"],
          ["GET /api/rate",          "120 / min per IP"],
          ["POST /api/hash-pin",     "5 / min per IP"],
          ["POST /api/parse-intent", "20 / min per user"],
          ["POST /api/chat",         "20 / min per user"],
        ].map(([route, limit], i, arr) => (
          <div
            key={route}
            className="flex gap-8 px-5 py-3.5 text-sm"
            style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}
          >
            <code
              className="w-52 flex-shrink-0 text-xs"
              style={{ color: "#90bff0", background: "none", padding: 0, border: "none" }}
            >
              {route}
            </code>
            <span style={{ color: "var(--text-muted)" }}>{limit}</span>
          </div>
        ))}
      </div>
      <p>
        When a limit is exceeded, Auron returns <code>429 Too Many Requests</code> with a <code>Retry-After</code> header indicating when the window resets.
      </p>

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
        The verifier retries up to 4× on RPC nodes that haven&apos;t propagated the transaction yet. Never call <code>/api/v1/pay</code> before waiting for on-chain confirmation in your frontend — pass <code>commitment: "confirmed"</code> to <code>confirmTransaction</code> first.
      </Callout>

      <h2>PIN security</h2>
      <p>
        User PINs are hashed with <strong>Argon2id</strong> on the server via <code>/api/hash-pin</code>. The raw PIN never leaves the browser in plaintext. PIN hashes are excluded from <code>localStorage</code> persistence in the Zustand store via <code>partialize</code>.
      </p>

      <h2>API key storage</h2>
      <p>
        API keys are stored as SHA-256 hashes only. Auron never logs, stores, or transmits raw key values. To revoke a key, set <code>is_active = false</code> in the <code>api_keys</code> table — the hash becomes inactive immediately without any cache invalidation delay.
      </p>

      <PageNav />
    </div>
  );
}
