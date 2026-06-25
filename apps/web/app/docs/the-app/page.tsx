import type { Metadata } from "next";
import Callout from "@/components/docs/Callout";
import CodeBlock from "@/components/docs/CodeBlock";
import PageNav  from "@/components/docs/PageNav";

export const metadata: Metadata = { title: "The Auron App" };

function Feature({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "20px 22px" }}>
      <div className="flex items-center gap-3 mb-2">
        <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 18, color: "var(--lime)" }}>{icon}</span>
        <span style={{ fontFamily: "'Geist', sans-serif", fontWeight: 500, fontSize: 14, color: "var(--text)" }}>{title}</span>
      </div>
      <p style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7, margin: 0 }}>{children}</p>
    </div>
  );
}

export default function TheApp() {
  return (
    <div className="prose">
      <p className="mono-label">The App</p>
      <h1>The Auron App</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
        A conversational, AI-powered payment application. Users interact in natural language — Claude AI parses intent and constructs on-chain transactions invisibly. No crypto knowledge required.
      </p>

      <div
        className="inline-flex items-center gap-2 mb-8"
        style={{
          border: "1px solid var(--border)", background: "var(--surface)", padding: "6px 14px",
          borderRadius: 100, fontFamily: "'Geist Mono', monospace", fontSize: 11,
          color: "var(--text-muted)", letterSpacing: "0.06em",
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--lime)", flexShrink: 0, display: "inline-block" }} />
        LIVE AT AURON-MOCHA.VERCEL.APP
      </div>

      <hr />

      <h2>Core capabilities</h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
        <Feature icon="◎" title="AI Intent Engine">
          Type &ldquo;pay ₹500 to Swiggy&rdquo; — Claude Sonnet parses the intent into a structured payment action. Voice input supported on Chrome.
        </Feature>
        <Feature icon="⬡" title="QR Scanner">
          Camera-based UPI QR scanner powered by ZXing. Scan any merchant QR and enter the amount — bypasses the AI entirely for speed.
        </Feature>
        <Feature icon="◈" title="Phantom Wallet">
          Desktop via the Phantom extension. Mobile via deep link — opens Phantom app, authenticates, redirects back with the signed transaction.
        </Feature>
        <Feature icon="◐" title="Spend Ceiling">
          User-configurable per-payment cap (default USDC 500) and daily cap (USDC 5,000). Hard-blocked at the server — not just UI validation.
        </Feature>
        <Feature icon="◉" title="PIN Protection">
          Optional hold-to-pay PIN hashed with argon2id server-side. Raw PIN never stored. Required above a configurable amount threshold.
        </Feature>
        <Feature icon="◆" title="Transaction History">
          Full payment history with audit trail drawer. Each entry shows: amount, merchant, UTR, Solscan link, and the full state machine timeline.
        </Feature>
      </div>

      <hr />

      <h2>AI chat interface</h2>
      <p>
        The primary interaction mode. The chat interface streams Claude&apos;s response in real time using Server-Sent Events. The system prompt is 107 lines and cached with <code>cache_control: ephemeral</code> — subsequent requests use the cached version, saving ~90% of token cost.
      </p>

      <p>When Claude identifies a payment intent, it returns two payloads separated by <code>|||</code>:</p>
      <CodeBlock
        language="text"
        code={`Here's your payment for ₹500 to Swiggy. The USDC equivalent at today's rate is 5.94 USDC.
|||{"action":"upi_payment","upi_id":"swiggy@icici","inr_amount":500,"usdcAmount":5.94,"confidence":0.97}|||`}
      />
      <p>The left side is displayed to the user. The right is parsed as a structured action and dispatched to the payment flow.</p>

      <h3>Supported actions</h3>
      <div style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
        {[
          ["upi_payment",        "USDC → treasury → INR → UPI payout to merchant"],
          ["transfer_usdc",      "USDC transfer to any Solana wallet address"],
          ["transfer_sol",       "SOL transfer to any Solana wallet address"],
          ["lock_savings",       "Time-locked USDC deposit into the Anchor vault program"],
          ["stamp_agreement",    "SHA-256 agreement hash written as a Solana memo"],
          ["stamp_ownership",    "File ownership proof written as a Solana memo"],
          ["generate_pay_link",  "Shareable /pay/[slug] URL with prefilled amount"],
          ["spending_query",     "Query daily spend and cap status from local state"],
        ].map(([action, desc], i, arr) => (
          <div key={action} className="flex gap-5 px-5 py-3" style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}>
            <code style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "var(--lime)", background: "none", padding: 0, border: "none", width: 160, flexShrink: 0 }}>{action}</code>
            <span style={{ fontFamily: "'Geist', sans-serif", fontSize: 13, color: "var(--text-muted)" }}>{desc}</span>
          </div>
        ))}
      </div>

      <hr />

      <h2 id="onboarding">Onboarding & PIN</h2>
      <p>First-time users go through a 3-step onboarding flow before any payment is possible:</p>

      <div style={{ marginTop: 20, marginBottom: 32 }}>
        {[
          { n: "01", title: "Wallet connection", body: "Phantom desktop or mobile deep link. The Solana public key becomes the user identity — no email or phone required at this stage." },
          { n: "02", title: "Spend ceiling", body: "User sets a per-payment maximum (default ₹5,000 / USDC 60) and a daily cap (default USDC 5,000). These are enforced server-side — the UI cannot bypass them." },
          { n: "03", title: "PIN setup", body: "Optional 4–8 digit PIN. Sent to POST /api/hash-pin — argon2id hashed server-side with memoryCost=65536, timeCost=3, parallelism=1. Raw PIN never persists. The hash is stored in the Zustand store with localStorage persistence, excluded from the network." },
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

      <h2 id="blinks">Solana Blinks</h2>
      <p>
        Every Auron pay link is simultaneously a human-readable payment page and a <strong>composable Solana Action</strong> — operable inside X/Twitter, Dialect, and Phantom without leaving the host surface.
      </p>
      <CodeBlock
        language="bash"
        code={`# Human-readable payment page
https://auron-mocha.vercel.app/pay/demo?amount=500&note=Lunch

# Same URL — paste into a tweet, it becomes an executable payment
# No redirect. No separate app. Signs directly in Phantom.`}
      />
      <CodeBlock
        language="bash"
        code={`# Solana Actions endpoints
GET  /api/actions/pay   →  action metadata + label
POST /api/actions/pay   →  serialized transaction for wallet signing`}
      />
      <Callout type="tip">
        Paste any Auron pay link into a tweet — Dialect renders a Pay button natively. The user taps, approves in Phantom, and the merchant is paid. Zero redirects.
      </Callout>

      <hr />

      <h2>ConfirmCard — the payment gate</h2>
      <p>Before any wallet signature is requested, the ConfirmCard shows the user exactly what will happen:</p>
      <ul>
        <li><strong>Amount mirror</strong> — INR amount, USDC equivalent, live FX rate</li>
        <li><strong>60-second quote timer</strong> — auto-dismisses at expiry (800ms grace period)</li>
        <li><strong>Hold-to-pay</strong> — 1,500ms hold required. Prevents accidental payments. Haptic feedback on hold start.</li>
        <li><strong>Security flags</strong> — urgency keywords, large amounts, new recipients displayed inline</li>
        <li><strong>Disabled state</strong> — opacity 0.35, pointer-events none after quote expires</li>
      </ul>

      <Callout type="info">
        The ConfirmCard is shown for both the AI chat path and the QR scan path. It is the single point where the user explicitly authorizes the transaction — nothing triggers Phantom before this.
      </Callout>

      <PageNav />
    </div>
  );
}
