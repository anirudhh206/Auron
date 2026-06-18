import type { Metadata } from "next";
import CodeBlock from "@/components/CodeBlock";
import Callout   from "@/components/Callout";
import PageNav   from "@/components/PageNav";

export const metadata: Metadata = { title: "Introduction" };

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full"
      style={{ background: "var(--accent-muted)", color: "var(--accent)", border: "1px solid var(--accent-border)" }}
    >
      {children}
    </span>
  );
}

export default function Introduction() {
  return (
    <div className="prose">
      {/* Breadcrumb */}
      <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "var(--text-subtle)", letterSpacing: "0.1em" }}>
        Getting Started
      </p>

      {/* Hero */}
      <div className="mb-8">
        <h1 style={{ background: "linear-gradient(135deg, #e2e2f0 0%, #9d8fff 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
          Introduction to Auron
        </h1>
        <p className="text-base mt-3" style={{ color: "var(--text-muted)", maxWidth: "560px" }}>
          A programmable stablecoin settlement layer for India. Accept USDC on Solana — merchant receives INR via UPI. No crypto setup required on their end.
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          <Badge>Solana</Badge>
          <Badge>USDC</Badge>
          <Badge>UPI</Badge>
          <Badge>AI agents</Badge>
        </div>
      </div>

      <hr />

      <h2>What Auron solves</h2>
      <p>
        India has 350M+ UPI users but no easy bridge between crypto and local payments. Merchants don&apos;t want to hold stablecoins. Builders don&apos;t want to build payment rails from scratch. Auron handles the entire settlement pipeline.
      </p>
      <ul>
        <li>User pays in USDC on Solana — familiar for Web3 users</li>
        <li>Merchant receives INR via UPI — no crypto knowledge required</li>
        <li>The blockchain stays invisible to both parties</li>
        <li>AI agents can initiate payments programmatically via API key</li>
      </ul>

      <h2>Two integration modes</h2>

      <h3>SDK mode — for apps and agents</h3>
      <p>
        Authenticate with an <code>ak_live_xxx</code> API key. Call <code>getQuote()</code> server-side, build your UI, submit the transaction signature for settlement. Daily spend limits are enforced per key.
      </p>

      <h3>Human wallet mode — for browser flows</h3>
      <p>
        No API key required. The user connects Phantom directly, signs the USDC transfer in their wallet, and your frontend submits the signature to Auron. Auron verifies on-chain and settles to the merchant&apos;s UPI — your app never touches a private key.
      </p>

      <Callout type="info">
        Both modes run the same 6-layer on-chain verification before any settlement is triggered. There is no &ldquo;test mode that skips real checks.&rdquo;
      </Callout>

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
// quote.usdcAmount  → 11.84
// quote.auronRate   → 84.37 INR/USDC

// 2. After user signs on-chain transfer:
const res = await fetch("/api/v1/pay", {
  method:  "POST",
  headers: { "Content-Type": "application/json", "x-api-key": "ak_live_xxx" },
  body: JSON.stringify({
    txSignature:   "<solana_tx_signature>",
    merchantUpiId: "merchant@paytm",
    inrAmount:     999,
    usdcAmount:    quote.usdcAmount,
    paymentId:     crypto.randomUUID().replace(/-/g, ""),
    idempotencyKey:crypto.randomUUID().replace(/-/g, ""),
  }),
});`}
      />

      <h2>What&apos;s next</h2>
      <ul>
        <li><a href="/docs/quickstart">Quick Start</a> — go from zero to a working payment in 5 minutes</li>
        <li><a href="/docs/how-it-works">How It Works</a> — the full USDC → Solana → UPI flow explained</li>
        <li><a href="/docs/sdk">SDK Reference</a> — full AuronClient API documentation</li>
        <li><a href="/docs/api-reference">API Reference</a> — REST endpoints with all request/response schemas</li>
      </ul>

      <PageNav />
    </div>
  );
}
