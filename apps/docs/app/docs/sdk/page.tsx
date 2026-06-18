import type { Metadata } from "next";
import CodeBlock from "@/components/CodeBlock";
import Callout   from "@/components/Callout";
import PageNav   from "@/components/PageNav";

export const metadata: Metadata = { title: "SDK Reference" };

function Param({ name, type, required, children }: { name: string; type: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="py-4 border-b" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center gap-3 mb-1.5">
        <code className="text-sm font-semibold" style={{ color: "var(--text)", background: "none", padding: 0, border: "none" }}>{name}</code>
        <code className="text-xs" style={{ color: "#80cbc4", background: "none", padding: 0, border: "none" }}>{type}</code>
        {required && (
          <span
            className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded"
            style={{ background: "var(--amber-muted)", color: "var(--amber)", letterSpacing: "0.06em" }}
          >
            required
          </span>
        )}
      </div>
      <p className="text-sm m-0" style={{ color: "var(--text-muted)" }}>{children}</p>
    </div>
  );
}

export default function SdkReference() {
  return (
    <div className="prose">
      <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "var(--text-subtle)", letterSpacing: "0.1em" }}>
        SDK
      </p>
      <h1>SDK Reference</h1>
      <p style={{ color: "var(--text-muted)" }}>
        <code>@auron-solana/sdk</code> — a fully typed client for Node.js, browsers, and AI agents.
      </p>

      <hr />

      <h2>Installation</h2>
      <CodeBlock language="bash" code={`npm install @auron-solana/sdk`} />
      <CodeBlock language="bash" code={`yarn add @auron-solana/sdk`} />
      <CodeBlock language="bash" code={`pnpm add @auron-solana/sdk`} />

      <Callout type="info">
        The SDK ships full TypeScript definitions. No <code>@types</code> package required.
      </Callout>

      <h2 id="client">AuronClient</h2>
      <p>The main entry point. Create one instance per application — safe to share across requests.</p>
      <CodeBlock
        language="ts"
        code={`import { AuronClient } from "@auron-solana/sdk";

const auron = new AuronClient({
  apiKey:  "ak_live_xxx",
  baseUrl: "https://auron-mocha.vercel.app",
});`}
      />

      <h3>Constructor options</h3>
      <div style={{ border: "1px solid var(--border)", borderRadius: "6px", overflow: "hidden" }}>
        <div className="px-5">
          <Param name="apiKey" type="string" required>
            Your Auron API key. Use <code>ak_test_xxx</code> for development, <code>ak_live_xxx</code> for production. Keep this server-side only — never expose in client bundles.
          </Param>
          <Param name="baseUrl" type="string" required>
            Base URL of your Auron deployment. Hosted instance: <code>https://auron-mocha.vercel.app</code>
          </Param>
          <div className="py-4">
            <div className="flex items-center gap-3 mb-1.5">
              <code className="text-sm font-semibold" style={{ color: "var(--text)", background: "none", padding: 0, border: "none" }}>timeout</code>
              <code className="text-xs" style={{ color: "#80cbc4", background: "none", padding: 0, border: "none" }}>number</code>
            </div>
            <p className="text-sm m-0" style={{ color: "var(--text-muted)" }}>Request timeout in milliseconds. Default: <code>30000</code> (30 s).</p>
          </div>
        </div>
      </div>

      <h2 id="getquote">getQuote(inrAmount)</h2>
      <p>
        Fetches the current USDC/INR rate and returns the USDC amount required to settle a given INR payment. Quotes reflect the live CoinGecko rate plus spread, valid for <strong>60 seconds</strong>.
      </p>
      <CodeBlock
        language="ts"
        code={`const quote = await auron.getQuote(999);

// QuoteResult:
// {
//   inrAmount:   999,
//   usdcAmount:  11.84,
//   auronRate:   84.37,    // INR per USDC (after spread)
//   marketRate:  84.79,    // raw CoinGecko rate
//   spread:      0.005,    // Auron fee (0.5%)
//   validUntil:  1718734800000
// }`}
      />

      <h3>Parameters</h3>
      <div className="px-5" style={{ border: "1px solid var(--border)", borderRadius: "6px" }}>
        <Param name="inrAmount" type="number" required>
          The INR amount to be paid to the merchant. Must be a positive finite number.
        </Param>
      </div>

      <h3>Return type</h3>
      <CodeBlock
        language="ts"
        code={`interface QuoteResult {
  inrAmount:   number;   // echoed back
  usdcAmount:  number;   // USDC to send (6 dp precision)
  auronRate:   number;   // effective INR/USDC rate
  marketRate:  number;   // raw CoinGecko rate
  spread:      number;   // fee as decimal, e.g. 0.005
  validUntil:  number;   // expiry (Unix ms)
}`}
      />

      <h2 id="errors">Error handling</h2>
      <p>
        All SDK methods throw <code>AuronError</code> on failure. Check the <code>code</code> field to distinguish error types programmatically.
      </p>
      <CodeBlock
        language="ts"
        code={`import { AuronClient, AuronError } from "@auron-solana/sdk";

try {
  const quote = await auron.getQuote(999);
} catch (err) {
  if (err instanceof AuronError) {
    switch (err.code) {
      case "RATE_UNAVAILABLE":
        // CoinGecko down, no cached rate — show fallback UI
        break;
      case "RATE_LIMIT_EXCEEDED":
        // Wait and retry
        break;
      case "UNAUTHORIZED":
        // Check your API key
        break;
    }
  }
}`}
      />

      <h3>Error codes</h3>
      <div style={{ border: "1px solid var(--border)", borderRadius: "6px", overflow: "hidden" }}>
        {[
          ["RATE_UNAVAILABLE",    "CoinGecko unavailable and no cached rate exists"],
          ["INVALID_AMOUNT",      "inrAmount is zero, negative, or non-finite"],
          ["UNAUTHORIZED",        "API key missing, invalid, or revoked"],
          ["RATE_LIMIT_EXCEEDED", "Too many requests from this IP or key"],
          ["NETWORK_ERROR",       "Could not reach the Auron API"],
        ].map(([code, desc], i, arr) => (
          <div
            key={code}
            className="flex gap-6 px-5 py-3.5 text-sm"
            style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}
          >
            <code
              className="w-52 flex-shrink-0 text-xs"
              style={{ color: "#80cbc4", background: "none", padding: 0, border: "none" }}
            >
              {code}
            </code>
            <span style={{ color: "var(--text-muted)" }}>{desc}</span>
          </div>
        ))}
      </div>

      <PageNav />
    </div>
  );
}
