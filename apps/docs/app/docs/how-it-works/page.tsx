import type { Metadata } from "next";
import Callout from "@/components/Callout";
import PageNav from "@/components/PageNav";

export const metadata: Metadata = { title: "How It Works" };

export default function HowItWorks() {
  const steps = [
    { n: "01", title: "Quote request",               tag: "SDK",                   body: "The frontend calls auron.getQuote(inrAmount). Auron fetches the live rate from CoinGecko, applies a 0.5% spread, and returns the USDC amount the user must send. The rate is locked for 60 seconds." },
    { n: "02", title: "Wallet signs the transfer",    tag: "Phantom",               body: "The user approves in Phantom. A TransferChecked SPL instruction moves USDC from the user's ATA to Auron's treasury ATA. The private key never leaves the wallet — your app only receives the confirmed signature." },
    { n: "03", title: "Signature submitted to Auron", tag: "POST /api/v1/pay",      body: "Once Solana confirms, the frontend sends the signature and payment metadata to Auron. No funds are sent to Auron — only the cryptographic proof that the on-chain transfer happened." },
    { n: "04", title: "6-layer on-chain verification",tag: "lib/verify-tx.ts",      body: "Auron fetches the parsed transaction from a Solana RPC node and runs six independent checks. A failure at any layer halts the payment with a descriptive error — no partial settlements." },
    { n: "05", title: "INR settlement via Razorpay",  tag: "Razorpay Payout API",   body: "If all checks pass, Auron triggers a Razorpay Payout for the INR equivalent to the merchant's UPI ID. Idempotency keys are stored in Vercel KV so a retry never double-pays." },
    { n: "06", title: "Merchant receives INR",        tag: "UPI",                   body: "The merchant's UPI app shows a credit notification — typically within 2–3 minutes. They never need to know a blockchain was involved. You receive a UTR for reconciliation." },
  ];

  const checks = [
    { n: 1, label: "Signature confirmed",  desc: "Transaction must be confirmed or finalized on Solana. Retries 4× (12 s total) before failing." },
    { n: 2, label: "Correct USDC mint",    desc: "Transfer must reference the canonical USDC mint. Fake tokens are rejected here." },
    { n: 3, label: "Treasury ATA match",   desc: "Destination must be Auron's derived treasury ATA. Hard failure on mainnet; warn-only on devnet." },
    { n: 4, label: "Amount tolerance",     desc: "On-chain USDC must match quoted amount within 2%. Handles wallet rounding differences." },
    { n: 5, label: "Idempotency guard",    desc: "Signature stored in Vercel KV after first settlement. Re-submission returns 409." },
    { n: 6, label: "IP rate limit",        desc: "10 payment attempts per minute per IP. API key holders get higher per-key limits." },
  ];

  return (
    <div className="prose">
      <p className="mono-label">Getting Started</p>
      <h1>How It Works</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
        From the moment a user clicks &ldquo;Pay&rdquo; to the merchant receiving INR — every step explained.
      </p>
      <hr />

      <h2>The settlement flow</h2>

      <div style={{ marginTop: 24, marginBottom: 32 }}>
        {steps.map((s, i) => (
          <div key={s.n} className="flex gap-5 mb-0">
            <div className="flex flex-col items-center flex-shrink-0">
              <span
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: 32,
                  fontWeight: 300,
                  color: "var(--border-bright)",
                  lineHeight: 1,
                  flexShrink: 0,
                  width: 48,
                  textAlign: "right",
                }}
              >
                {s.n}
              </span>
              {i < steps.length - 1 && (
                <div style={{ width: 1, flex: 1, background: "var(--border)", marginTop: 8, minHeight: 32 }} />
              )}
            </div>
            <div style={{ paddingBottom: i < steps.length - 1 ? 32 : 0, paddingLeft: 16, flex: 1 }}>
              <div className="flex items-center gap-3 mb-2">
                <span style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 15, color: "var(--text)" }}>
                  {s.title}
                </span>
                <span
                  style={{
                    fontFamily: "'Geist Mono', monospace",
                    fontSize: 10,
                    color: "var(--text-dim)",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    padding: "2px 8px",
                    borderRadius: 4,
                    letterSpacing: "0.06em",
                  }}
                >
                  {s.tag}
                </span>
              </div>
              <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", lineHeight: 1.75, margin: 0 }}>{s.body}</p>
            </div>
          </div>
        ))}
      </div>

      <h2>The 6 verification checks</h2>
      <div style={{ border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {checks.map((c, i) => (
          <div
            key={c.n}
            className="flex gap-4 px-5 py-4"
            style={i < checks.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}
          >
            <span
              style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 11,
                color: "var(--lime)",
                background: "var(--lime-glow)",
                border: "1px solid var(--lime-border)",
                width: 24,
                height: 24,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              {c.n}
            </span>
            <div>
              <p style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 14, color: "var(--text)", marginBottom: 4 }}>{c.label}</p>
              <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{c.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <h2>Network reference</h2>
      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {[
          ["BLOCKCHAIN",     "Solana"],
          ["PAYMENT TOKEN",  "USDC · 6 decimals"],
          ["DEVNET USDC",    "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"],
          ["MAINNET USDC",   "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"],
          ["RATE SOURCE",    "CoinGecko · cached 60s · 0.5% spread"],
          ["SETTLEMENT",     "Razorpay Payout API → UPI"],
        ].map(([k, v], i, arr) => (
          <div
            key={k}
            className="flex gap-6 px-5 py-3"
            style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}
          >
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 10, color: "var(--text-dim)", letterSpacing: "0.1em", width: 140, flexShrink: 0 }}>{k}</span>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "var(--text-muted)" }}>{v}</span>
          </div>
        ))}
      </div>

      <Callout type="warn">
        On <strong>mainnet-beta</strong> all 6 checks are hard failures — no warn-only mode. Test thoroughly on devnet before switching <code>NEXT_PUBLIC_SOLANA_NETWORK</code> to <code>mainnet-beta</code>.
      </Callout>

      <PageNav />
    </div>
  );
}
