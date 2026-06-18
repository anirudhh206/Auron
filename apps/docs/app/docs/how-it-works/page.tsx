import type { Metadata } from "next";
import Callout from "@/components/Callout";
import PageNav from "@/components/PageNav";

export const metadata: Metadata = { title: "How It Works" };

function FlowStep({ n, title, tag, children }: { n: number; title: string; tag: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 mb-0">
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 z-10"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          {n}
        </div>
        <div className="w-px flex-1 mt-0" style={{ background: "var(--border)", minHeight: "40px" }} />
      </div>
      <div
        className="mb-0 pb-8 flex-1 ml-1"
      >
        <div className="flex items-center gap-3 mb-2 mt-0.5">
          <span className="font-semibold text-sm" style={{ color: "var(--text)" }}>{title}</span>
          <span
            className="text-[10px] uppercase font-medium px-2 py-0.5 rounded"
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

export default function HowItWorks() {
  return (
    <div className="prose">
      <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "var(--text-subtle)", letterSpacing: "0.1em" }}>
        Getting Started
      </p>
      <h1>How It Works</h1>
      <p style={{ color: "var(--text-muted)" }}>
        What happens from the moment a user clicks &ldquo;Pay&rdquo; to the merchant receiving INR in their UPI account.
      </p>

      <hr />

      <h2>The settlement flow</h2>

      <div className="mt-6">
        <FlowStep n={1} title="Quote request" tag="SDK">
          The frontend calls <code>auron.getQuote(inrAmount)</code>. Auron fetches the live rate from CoinGecko, applies a fixed 0.5% spread, and returns the USDC amount the user must send. The rate is locked for <strong style={{ color: "var(--text)" }}>60 seconds</strong>.
        </FlowStep>

        <FlowStep n={2} title="Wallet signs the transfer" tag="Phantom">
          The user approves in Phantom. A <code>TransferChecked</code> SPL instruction moves USDC from the user&apos;s ATA to Auron&apos;s treasury ATA. The private key never leaves the wallet — your app only receives the confirmed transaction signature.
        </FlowStep>

        <FlowStep n={3} title="Signature submitted to Auron" tag="POST /api/v1/pay">
          Once Solana confirms the transaction, the frontend sends the signature + payment metadata to Auron. No funds are sent to Auron — just the proof that the on-chain transfer happened.
        </FlowStep>

        <FlowStep n={4} title="6-layer on-chain verification" tag="lib/verify-tx.ts">
          Auron fetches the parsed transaction from a Solana RPC node and runs six independent checks before any settlement action. A failure at any layer halts the payment with a descriptive error.
        </FlowStep>

        <FlowStep n={5} title="INR settlement via Razorpay" tag="Razorpay Payout API">
          If all checks pass, Auron triggers a Razorpay Payout for the INR equivalent to the merchant&apos;s UPI ID. Idempotency keys are stored in Vercel KV so a retry never double-pays.
        </FlowStep>

        <FlowStep n={6} title="Merchant receives INR" tag="UPI">
          The merchant&apos;s UPI app shows a credit notification — typically within 2–3 minutes. They never need to know a blockchain was involved.
        </FlowStep>
      </div>

      <h2>The 6 verification checks</h2>
      <div style={{ border: "1px solid var(--border)", borderRadius: "6px", overflow: "hidden" }}>
        {[
          { n: 1, label: "Signature confirmed",   desc: "Transaction must be confirmed or finalized on Solana. Retries up to 4× (12 s) before failing." },
          { n: 2, label: "Correct USDC mint",     desc: "Transfer instruction must reference the canonical USDC mint. Fake tokens are rejected here." },
          { n: 3, label: "Treasury ATA match",    desc: "Destination must be Auron's derived treasury ATA. Hard failure on mainnet; warn-only on devnet." },
          { n: 4, label: "Amount tolerance",      desc: "On-chain USDC must match the quoted amount within 2%. Handles wallet rounding differences." },
          { n: 5, label: "Idempotency guard",     desc: "Signature stored in Vercel KV after first settlement. Re-submission returns 409." },
          { n: 6, label: "IP rate limit",         desc: "10 payment attempts per minute per IP. API key holders have higher per-key limits." },
        ].map((row, i, arr) => (
          <div
            key={row.n}
            className="flex gap-4 px-5 py-4 text-sm"
            style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}
          >
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5"
              style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
            >
              {row.n}
            </span>
            <div>
              <p className="font-medium mb-0.5" style={{ color: "var(--text)" }}>{row.label}</p>
              <p className="text-xs m-0" style={{ color: "var(--text-muted)" }}>{row.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <h2>Network & token reference</h2>
      <div style={{ border: "1px solid var(--border)", borderRadius: "6px", overflow: "hidden" }}>
        {[
          ["Blockchain",       "Solana"],
          ["Payment token",    "USDC · 6 decimals"],
          ["Devnet USDC mint", "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"],
          ["Mainnet USDC",     "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"],
          ["Rate source",      "CoinGecko · cached 60 s · 0.5% spread"],
          ["Settlement",       "Razorpay Payout API → UPI"],
          ["Wallet",           "Phantom (browser extension + mobile deep link)"],
        ].map(([label, value], i, arr) => (
          <div
            key={label}
            className="flex gap-6 px-5 py-3.5 text-sm"
            style={i < arr.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}}
          >
            <span className="w-36 flex-shrink-0 font-medium" style={{ color: "var(--text)" }}>{label}</span>
            <span
              style={{
                color:      "var(--text-muted)",
                fontFamily: label.includes("mint") || label.includes("USDC m") ? "monospace" : "inherit",
                fontSize:   label.includes("mint") ? "0.75rem" : "inherit",
              }}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      <h2>Devnet vs mainnet</h2>
      <p>Set <code>NEXT_PUBLIC_SOLANA_NETWORK</code> in your environment to switch networks. Auron automatically picks the correct USDC mint and validation mode.</p>

      <Callout type="warn">
        On <strong style={{ color: "var(--text)" }}>mainnet-beta</strong>, all 6 verification checks are hard failures. There is no warn-only mode. Test thoroughly on devnet before switching.
      </Callout>

      <PageNav />
    </div>
  );
}
