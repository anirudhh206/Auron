import type { Metadata } from "next";
import CodeBlock from "@/components/CodeBlock";
import Callout   from "@/components/Callout";
import PageNav   from "@/components/PageNav";

export const metadata: Metadata = { title: "SDK Reference" };

function Param({ name, type, required, children }: { name: string; type: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="py-4 border-b" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center gap-3 mb-2">
        <code style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: "var(--text)", background: "none", padding: 0, border: "none" }}>{name}</code>
        <code style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "var(--lime)", background: "none", padding: 0, border: "none" }}>{type}</code>
        {required && (
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: "var(--gold)", background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.2)", padding: "2px 8px", borderRadius: 4, letterSpacing: "0.06em" }}>
            REQUIRED
          </span>
        )}
      </div>
      <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", margin: 0 }}>{children}</p>
    </div>
  );
}

export default function SdkReference() {
  return (
    <div className="prose">
      <p className="mono-label">SDK</p>
      <h1>SDK Reference</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
        <code>@auron-solana/sdk</code> — a fully typed client for Node.js, browsers, and AI agents.
      </p>
      <hr />

      <h2>Installation</h2>
      <CodeBlock language="bash" code={`npm install @auron-solana/sdk`} />
      <CodeBlock language="bash" code={`yarn add @auron-solana/sdk`} />

      <Callout type="info">
        The SDK ships full TypeScript definitions. No separate <code>@types</code> package needed.
      </Callout>

      <h2 id="client">AuronClient</h2>
      <p>The main entry point. Create one instance per application — safe to share across concurrent requests.</p>
      <CodeBlock
        language="ts"
        code={`import { AuronClient } from "@auron-solana/sdk";

const auron = new AuronClient({
  apiKey:  "ak_live_xxx",
  baseUrl: "https://auron-mocha.vercel.app",
});`}
      />

      <h3>Constructor options</h3>
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        <div className="px-5">
          <Param name="apiKey"  type="string" required>Your Auron API key. Use <code>ak_test_xxx</code> for development, <code>ak_live_xxx</code> for production. Never expose in client-side bundles.</Param>
          <Param name="baseUrl" type="string" required>Base URL of your Auron deployment. Hosted: <code>https://auron-mocha.vercel.app</code></Param>
          <div className="py-4">
            <div className="flex items-center gap-3 mb-2">
              <code style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: "var(--text)", background: "none", padding: 0, border: "none" }}>timeout</code>
              <code style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "var(--lime)", background: "none", padding: 0, border: "none" }}>number</code>
            </div>
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", margin: 0 }}>Request timeout in milliseconds. Default: <code>30000</code> (30 s).</p>
          </div>
        </div>
      </div>

      <h2 id="getquote">getQuote(inrAmount)</h2>
      <p>Returns the USDC amount required for a given INR payment at the current live rate. Quotes are valid for <strong>60 seconds</strong>.</p>
      <CodeBlock
        language="ts"
        code={`const quote = await auron.getQuote(999);

// {
//   inrAmount:   999,
//   usdcAmount:  11.84,
//   auronRate:   84.37,   // INR per USDC (after 0.5% spread)
//   marketRate:  84.79,   // raw CoinGecko rate
//   spread:      0.005,
//   validUntil:  1718734800000
// }`}
      />

      <h3>Return type</h3>
      <CodeBlock
        language="ts"
        code={`interface QuoteResult {
  inrAmount:   number;
  usdcAmount:  number;
  auronRate:   number;
  marketRate:  number;
  spread:      number;
  validUntil:  number;  // Unix ms
}`}
      />

      <h2 id="errors">Error handling</h2>
      <CodeBlock
        language="ts"
        code={`import { AuronClient, AuronError } from "@auron-solana/sdk";

try {
  const quote = await auron.getQuote(999);
} catch (err) {
  if (err instanceof AuronError) {
    // err.code    → "RATE_UNAVAILABLE" | "UNAUTHORIZED" | ...
    // err.message → human-readable description
    // err.status  → HTTP status code
  }
}`}
      />

      <h3>Error codes</h3>
      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {[
          ["RATE_UNAVAILABLE",    "CoinGecko unavailable and no cached rate exists"],
          ["INVALID_AMOUNT",      "inrAmount is zero, negative, or non-finite"],
          ["UNAUTHORIZED",        "API key missing, invalid, or revoked"],
          ["RATE_LIMIT_EXCEEDED", "Too many requests from this IP or key"],
          ["NETWORK_ERROR",       "Could not reach the Auron API"],
        ].map(([code, desc], i, arr) => (
          <div key={code} className="flex gap-6 px-5 py-3" style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}>
            <code style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "var(--lime)", background: "none", padding: 0, border: "none", width: 200, flexShrink: 0 }}>{code}</code>
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-muted)" }}>{desc}</span>
          </div>
        ))}
      </div>

      <PageNav />
    </div>
  );
}
