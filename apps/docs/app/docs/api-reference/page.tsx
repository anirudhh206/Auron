import type { Metadata } from "next";
import CodeBlock from "@/components/CodeBlock";
import Callout   from "@/components/Callout";
import PageNav   from "@/components/PageNav";

export const metadata: Metadata = { title: "API Reference" };

function MethodBadge({ method }: { method: "POST" | "GET" }) {
  const s = {
    POST: { bg: "var(--lime-glow)", color: "var(--lime)", border: "var(--lime-border)" },
    GET:  { bg: "rgba(39,116,202,0.1)", color: "#60a5fa", border: "rgba(39,116,202,0.3)" },
  }[method];
  return (
    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, fontWeight: 600, background: s.bg, color: s.color, border: `1px solid ${s.border}`, padding: "3px 10px", borderRadius: 4, letterSpacing: "0.06em", marginRight: 12 }}>
      {method}
    </span>
  );
}

function Field({ name, type, required, children }: { name: string; type: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="py-4 border-b" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center gap-3 mb-2">
        <code style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: "var(--text)", background: "none", padding: 0, border: "none" }}>{name}</code>
        <code style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "var(--lime)", background: "none", padding: 0, border: "none" }}>{type}</code>
        {required && (
          <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: "var(--gold)", background: "rgba(245,166,35,0.1)", border: "1px solid rgba(245,166,35,0.2)", padding: "2px 8px", borderRadius: 4, letterSpacing: "0.06em" }}>REQUIRED</span>
        )}
      </div>
      <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", margin: 0 }}>{children}</p>
    </div>
  );
}

export default function ApiReference() {
  return (
    <div className="prose">
      <p className="mono-label">API Reference</p>
      <h1>API Reference</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
        All endpoints served from your Auron deployment. Hosted instance: <code>https://auron-mocha.vercel.app</code>
      </p>
      <hr />

      <h2 id="auth">Authentication</h2>
      <p>Pass your API key in the <code>x-api-key</code> header. Keys are stored as SHA-256 hashes — the raw key is never persisted.</p>
      <CodeBlock language="bash" code={`curl -X POST https://auron-mocha.vercel.app/api/v1/pay \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ak_live_xxx" \\
  -d '{ ... }'`} />
      <Callout type="info">
        Omitting <code>x-api-key</code> triggers <strong>human wallet mode</strong> — requests pass through without authentication. Use this for browser apps where the user signs the transaction themselves.
      </Callout>

      <hr />

      <h2 id="pay">Submit a payment</h2>
      <div className="flex items-center mb-4">
        <MethodBadge method="POST" />
        <code style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: "var(--text)", background: "none", padding: 0, border: "none" }}>/api/v1/pay</code>
      </div>
      <p>Verifies an on-chain USDC transfer and queues a Razorpay UPI payout. All 6 verification checks run before any payout is triggered.</p>

      <h3>Request body</h3>
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        <div className="px-5">
          <Field name="txSignature"    type="string"  required>Confirmed Solana transaction signature for the USDC transfer.</Field>
          <Field name="merchantUpiId"  type="string"  required>UPI ID of the merchant — e.g. <code>merchant@paytm</code></Field>
          <Field name="merchantName"   type="string"  required>Display name of the merchant.</Field>
          <Field name="inrAmount"      type="number"  required>INR amount the merchant should receive.</Field>
          <Field name="usdcAmount"     type="number"  required>USDC amount that was sent on-chain.</Field>
          <Field name="paymentId"      type="string"  required>Your unique payment ID (32 hex chars).</Field>
          <Field name="idempotencyKey" type="string"  required>Unique key per attempt. Reuse on retry to prevent double-pay.</Field>
          <Field name="userId"         type="string">Sender&apos;s Solana wallet address. Used for per-user rate limiting.</Field>
          <div className="py-4">
            <div className="flex items-center gap-3 mb-2">
              <code style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: "var(--text)", background: "none", padding: 0, border: "none" }}>quoteFxRate</code>
              <code style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "var(--lime)", background: "none", padding: 0, border: "none" }}>number</code>
            </div>
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", margin: 0 }}>FX rate from <code>getQuote()</code>. Enables price guard — rejects payments where the live rate moved more than 2% against the quote.</p>
          </div>
        </div>
      </div>

      <h3>Response</h3>
      <CodeBlock language="json" code={`{ "paymentId": "a1b2c3d4...", "status": "queued", "message": "Payment queued for settlement" }`} />

      <h3>Error codes</h3>
      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {[["400","Missing or invalid fields"],["401","API key invalid or revoked"],["409","Already settled (idempotency collision)"],["422","On-chain verification failed"],["429","Rate limit exceeded — check Retry-After"],["500","Internal error — safe to retry after 5 s"]].map(([code, desc], i, arr) => (
          <div key={code} className="flex gap-5 px-5 py-3" style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}>
            <code style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "#EF4444", background: "none", padding: 0, border: "none", width: 40, flexShrink: 0 }}>{code}</code>
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-muted)" }}>{desc}</span>
          </div>
        ))}
      </div>

      <hr />

      <h2 id="quote">Get a quote</h2>
      <div className="flex items-center mb-4">
        <MethodBadge method="GET" />
        <code style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: "var(--text)", background: "none", padding: 0, border: "none" }}>/api/quote?inrAmount=999</code>
      </div>
      <p>Live USDC amount for a given INR payment. Cached 60 s server-side.</p>
      <CodeBlock language="json" code={`{ "inrAmount": 999, "usdcAmount": 11.84, "auronRate": 84.37, "marketRate": 84.79, "spread": 0.005, "spreadPercent": "0.50%", "validUntil": 1718734800000 }`} />

      <hr />

      <h2 id="rate">Get current rate</h2>
      <div className="flex items-center mb-4">
        <MethodBadge method="GET" />
        <code style={{ fontFamily: "'Geist Mono', monospace", fontSize: 13, color: "var(--text)", background: "none", padding: 0, border: "none" }}>/api/rate</code>
      </div>
      <p>Current USDC/INR market rate and Auron&apos;s effective rate after spread.</p>
      <CodeBlock language="json" code={`{ "marketRate": 84.79, "auronRate": 84.37, "spread": 0.005, "spreadPercent": "0.50%", "fallback": false, "usdcPer1000Inr": 11.851 }`} />
      <Callout type="warn">
        When <code>fallback: true</code>, CoinGecko is unavailable and the rate comes from cache. Avoid locking in large quotes during fallback.
      </Callout>

      <PageNav />
    </div>
  );
}
