import type { Metadata } from "next";
import CodeBlock from "@/components/CodeBlock";
import Callout   from "@/components/Callout";
import PageNav   from "@/components/PageNav";

export const metadata: Metadata = { title: "API Reference" };

function MethodBadge({ method }: { method: "POST" | "GET" }) {
  const styles = {
    POST: { bg: "rgba(124,106,247,0.12)", text: "#a899ff", border: "rgba(124,106,247,0.25)" },
    GET:  { bg: "rgba(74,222,128,0.10)",  text: "#4ade80", border: "rgba(74,222,128,0.25)" },
  };
  const s = styles[method];
  return (
    <span
      className="inline-block text-xs font-bold px-2 py-0.5 rounded mr-3"
      style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}`, letterSpacing: "0.04em" }}
    >
      {method}
    </span>
  );
}

function Field({ name, type, required, children }: { name: string; type: string; required?: boolean; children: React.ReactNode }) {
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

export default function ApiReference() {
  return (
    <div className="prose">
      <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "var(--text-subtle)", letterSpacing: "0.1em" }}>
        API Reference
      </p>
      <h1>API Reference</h1>
      <p style={{ color: "var(--text-muted)" }}>
        All endpoints are served from your Auron deployment. Hosted instance:{" "}
        <code>https://auron-mocha.vercel.app</code>
      </p>

      <hr />

      <h2 id="auth">Authentication</h2>
      <p>
        API requests authenticate via the <code>x-api-key</code> header. Keys are stored as SHA-256 hashes — the raw key is never persisted.
      </p>
      <CodeBlock
        language="bash"
        code={`curl -X POST https://auron-mocha.vercel.app/api/v1/pay \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ak_live_xxx" \\
  -d '{ ... }'`}
      />
      <Callout type="info">
        Omitting <code>x-api-key</code> triggers <strong style={{ color: "var(--text)" }}>human wallet mode</strong> — requests are allowed through without authentication. Use this for browser apps where the user signs the transaction themselves.
      </Callout>

      <hr />

      <h2 id="pay">Submit a payment</h2>
      <div className="flex items-center mb-4">
        <MethodBadge method="POST" />
        <code style={{ color: "var(--text)", background: "none", padding: 0, border: "none" }}>/api/v1/pay</code>
      </div>
      <p>
        Verifies an on-chain USDC transfer and queues a Razorpay UPI payout to the merchant. This is the core settlement endpoint — all 6 verification checks run before any payout is triggered.
      </p>

      <h3>Request body</h3>
      <div style={{ border: "1px solid var(--border)", borderRadius: "6px", overflow: "hidden" }}>
        <div className="px-5">
          <Field name="txSignature"    type="string"  required>Confirmed Solana transaction signature for the USDC transfer.</Field>
          <Field name="merchantUpiId"  type="string"  required>UPI ID of the merchant (e.g. <code>merchant@paytm</code>).</Field>
          <Field name="merchantName"   type="string"  required>Display name of the merchant.</Field>
          <Field name="inrAmount"      type="number"  required>INR amount the merchant should receive.</Field>
          <Field name="usdcAmount"     type="number"  required>USDC amount that was sent on-chain.</Field>
          <Field name="paymentId"      type="string"  required>Your unique payment ID (32 hex chars).</Field>
          <Field name="idempotencyKey" type="string"  required>Unique key per payment attempt. Reuse on retry to prevent double-pay.</Field>
          <Field name="userId"         type="string">Sender&apos;s Solana wallet address. Used for per-user rate limiting.</Field>
          <div className="py-4">
            <div className="flex items-center gap-3 mb-1.5">
              <code className="text-sm font-semibold" style={{ color: "var(--text)", background: "none", padding: 0, border: "none" }}>quoteFxRate</code>
              <code className="text-xs" style={{ color: "#80cbc4", background: "none", padding: 0, border: "none" }}>number</code>
            </div>
            <p className="text-sm m-0" style={{ color: "var(--text-muted)" }}>The FX rate from <code>getQuote()</code>. Enables price guard — rejects payments where the live rate has moved more than 2% against the quote.</p>
          </div>
        </div>
      </div>

      <h3>Response</h3>
      <CodeBlock
        language="json"
        code={`{
  "paymentId": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4",
  "status":    "queued",
  "message":   "Payment queued for settlement"
}`}
      />

      <h3>Status values</h3>
      <div style={{ border: "1px solid var(--border)", borderRadius: "6px", overflow: "hidden" }}>
        {[
          { s: "queued",  c: "#60a5fa", d: "Verification passed, payout triggered. Settlement in progress." },
          { s: "settled", c: "#4ade80", d: "UPI payout confirmed by Razorpay." },
          { s: "failed",  c: "#f87171", d: "Settlement failed. Check the error field for details." },
        ].map((row, i, arr) => (
          <div
            key={row.s}
            className="flex gap-5 px-5 py-3.5 text-sm"
            style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}
          >
            <code className="w-20 flex-shrink-0" style={{ color: row.c, background: "none", padding: 0, border: "none" }}>{row.s}</code>
            <span style={{ color: "var(--text-muted)" }}>{row.d}</span>
          </div>
        ))}
      </div>

      <h3>Error responses</h3>
      <div style={{ border: "1px solid var(--border)", borderRadius: "6px", overflow: "hidden" }}>
        {[
          ["400", "Missing or invalid fields in request body"],
          ["401", "API key invalid, missing, or revoked"],
          ["409", "Transaction already settled (idempotency collision)"],
          ["422", "On-chain verification failed — wrong amount, destination, or tx not found"],
          ["429", "Rate limit exceeded — see Retry-After header"],
          ["500", "Internal error — safe to retry after 5 s"],
        ].map(([code, desc], i, arr) => (
          <div
            key={code}
            className="flex gap-6 px-5 py-3.5 text-sm"
            style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}
          >
            <code className="w-12 flex-shrink-0" style={{ color: "#f87171", background: "none", padding: 0, border: "none" }}>{code}</code>
            <span style={{ color: "var(--text-muted)" }}>{desc}</span>
          </div>
        ))}
      </div>

      <hr />

      <h2 id="quote">Get a quote</h2>
      <div className="flex items-center mb-4">
        <MethodBadge method="GET" />
        <code style={{ color: "var(--text)", background: "none", padding: 0, border: "none" }}>/api/quote?inrAmount=999</code>
      </div>
      <p>
        Returns the live USDC amount for a given INR payment. Rate is cached for 60 s server-side; clients should treat quotes as valid for 60 s from receipt.
      </p>

      <h3>Query parameters</h3>
      <div className="px-5" style={{ border: "1px solid var(--border)", borderRadius: "6px" }}>
        <Field name="inrAmount" type="number" required>INR amount to quote. Must be a positive number.</Field>
      </div>

      <h3>Response</h3>
      <CodeBlock
        language="json"
        code={`{
  "inrAmount":     999,
  "usdcAmount":    11.84,
  "auronRate":     84.37,
  "marketRate":    84.79,
  "spread":        0.005,
  "spreadPercent": "0.50%",
  "validUntil":    1718734800000
}`}
      />

      <hr />

      <h2 id="rate">Get current rate</h2>
      <div className="flex items-center mb-4">
        <MethodBadge method="GET" />
        <code style={{ color: "var(--text)", background: "none", padding: 0, border: "none" }}>/api/rate</code>
      </div>
      <p>
        Returns the current USDC/INR rate. Useful for displaying live rates without computing a full quote.
      </p>

      <h3>Response</h3>
      <CodeBlock
        language="json"
        code={`{
  "marketRate":     84.79,
  "auronRate":      84.37,
  "spread":         0.005,
  "spreadPercent":  "0.50%",
  "fallback":       false,
  "usdcPer1000Inr": 11.851
}`}
      />
      <Callout type="warn">
        When <code>fallback: true</code>, CoinGecko is unreachable and the rate comes from cache. Treat fallback rates as approximate and avoid locking in high-value quotes during this state.
      </Callout>

      <PageNav />
    </div>
  );
}
