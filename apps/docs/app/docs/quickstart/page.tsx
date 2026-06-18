import type { Metadata } from "next";
import CodeBlock from "@/components/CodeBlock";
import Callout   from "@/components/Callout";
import PageNav   from "@/components/PageNav";

export const metadata: Metadata = { title: "Quick Start" };

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 mb-8">
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          {n}
        </div>
        <div className="w-px flex-1 mt-2" style={{ background: "var(--border)" }} />
      </div>
      <div className="pb-6 flex-1">
        <p className="font-semibold text-sm mb-2 mt-0.5" style={{ color: "var(--text)" }}>{title}</p>
        <div style={{ color: "var(--text-muted)" }}>{children}</div>
      </div>
    </div>
  );
}

export default function QuickStart() {
  return (
    <div className="prose">
      <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "var(--text-subtle)", letterSpacing: "0.1em" }}>
        Getting Started
      </p>
      <h1>Quick Start</h1>
      <p style={{ color: "var(--text-muted)" }}>
        Get Auron payments working in your app in under 5 minutes.
      </p>

      <hr />

      <Step n={1} title="Install the SDK">
        <CodeBlock language="bash" code={`npm install @auron-solana/sdk`} />
      </Step>

      <Step n={2} title="Create a client">
        <p className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>Instantiate once per app. Keep server-side — never expose your API key in browser bundles.</p>
        <CodeBlock
          language="ts"
          filename="lib/auron.ts"
          code={`import { AuronClient } from "@auron-solana/sdk";

export const auron = new AuronClient({
  apiKey:  process.env.AURON_API_KEY!,  // ak_live_xxx
  baseUrl: "https://auron-mocha.vercel.app",
});`}
        />
      </Step>

      <Step n={3} title="Fetch a live quote">
        <p className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>Show the user exactly how much USDC they&apos;ll pay before they touch their wallet. Quotes are valid for <strong style={{ color: "var(--text)" }}>60 seconds</strong>.</p>
        <CodeBlock
          language="ts"
          code={`const quote = await auron.getQuote(999); // ₹999

console.log(quote.usdcAmount);  // 11.84
console.log(quote.auronRate);   // 84.37 INR/USDC
console.log(quote.validUntil);  // expiry timestamp`}
        />
      </Step>

      <Step n={4} title="User signs the on-chain transfer">
        <p className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>The USDC transfer happens entirely in the user&apos;s Phantom wallet. Your app passes the transaction along — it never handles private keys.</p>
        <CodeBlock
          language="ts"
          filename="lib/solana.ts"
          code={`import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { createTransferCheckedInstruction, getAssociatedTokenAddress } from "@solana/spl-token";

const USDC_MINT = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");
const TREASURY  = new PublicKey(process.env.NEXT_PUBLIC_AURON_TREASURY!);

export async function sendUSDC(fromWallet: string, usdcAmount: number): Promise<string> {
  const provider   = window.solana;
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const from       = new PublicKey(fromWallet);
  const fromATA    = await getAssociatedTokenAddress(USDC_MINT, from);
  const toATA      = await getAssociatedTokenAddress(USDC_MINT, TREASURY);
  const lamports   = Math.round(usdcAmount * 1_000_000);

  const tx = new Transaction().add(
    createTransferCheckedInstruction(fromATA, USDC_MINT, toATA, from, lamports, 6),
  );
  tx.feePayer        = from;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  const signed    = await provider.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}`}
        />
      </Step>

      <Step n={5} title="Submit for settlement">
        <p className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>Pass the confirmed signature to Auron. It verifies on-chain and triggers a Razorpay UPI payout to the merchant.</p>
        <CodeBlock
          language="ts"
          code={`const res = await fetch("https://auron-mocha.vercel.app/api/v1/pay", {
  method:  "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key":    process.env.AURON_API_KEY!,
  },
  body: JSON.stringify({
    paymentId:      crypto.randomUUID().replace(/-/g, ""),
    idempotencyKey: crypto.randomUUID().replace(/-/g, ""),
    merchantUpiId:  "merchant@paytm",
    merchantName:   "My Store",
    inrAmount:      999,
    usdcAmount:     quote.usdcAmount,
    txSignature:    signature,
    userId:         walletAddress,
    quoteFxRate:    quote.auronRate,
  }),
});

const { paymentId, status } = await res.json();
// status → "queued" | "settled" | "failed"`}
        />
        <Callout type="tip">
          Always use a fresh <code>idempotencyKey</code> per payment attempt. If the request times out and you retry, reuse the same key — Auron will de-duplicate and return the original result instead of double-paying.
        </Callout>
      </Step>

      <h2>Next steps</h2>
      <ul>
        <li><a href="/docs/how-it-works">How It Works</a> — understand the full settlement pipeline</li>
        <li><a href="/docs/sdk">SDK Reference</a> — all methods and types</li>
        <li><a href="/docs/examples">Examples</a> — a complete e-commerce checkout integration</li>
      </ul>

      <PageNav />
    </div>
  );
}
