import type { Metadata } from "next";
import CodeBlock from "@/components/CodeBlock";
import Callout   from "@/components/Callout";
import PageNav   from "@/components/PageNav";

export const metadata: Metadata = { title: "Quick Start" };

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 mb-2">
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className="w-7 h-7 flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{
            background: "var(--lime)",
            color: "#0A0A08",
            borderRadius: "50%",
            fontFamily: "'Geist Mono', monospace",
          }}
        >
          {n}
        </div>
        <div className="w-px flex-1 mt-2" style={{ background: "var(--border)", minHeight: 24 }} />
      </div>
      <div className="pb-6 flex-1">
        <p
          className="mt-0.5 mb-3"
          style={{ fontFamily: "'Geist', sans-serif", fontWeight: 600, fontSize: 15, color: "var(--text)" }}
        >
          {title}
        </p>
        <div>{children}</div>
      </div>
    </div>
  );
}

export default function QuickStart() {
  return (
    <div className="prose">
      <p className="mono-label">Getting Started</p>
      <h1>Quick Start</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "2rem" }}>
        Go from zero to a working USDC → UPI payment in under 5 minutes.
      </p>
      <hr />

      <Step n={1} title="Install the SDK">
        <CodeBlock language="bash" code={`npm install @auron-solana/sdk`} />
      </Step>

      <Step n={2} title="Create a client">
        <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: 12 }}>
          One instance per app. Keep server-side only — never ship your API key to the browser.
        </p>
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
        <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: 12 }}>
          Show the user the exact USDC cost before they open their wallet. Quotes are valid for 60 seconds.
        </p>
        <CodeBlock
          language="ts"
          code={`const quote = await auron.getQuote(999); // ₹999

// quote.usdcAmount  → 11.84
// quote.auronRate   → 84.37 INR/USDC
// quote.validUntil  → expiry timestamp (Unix ms)`}
        />
      </Step>

      <Step n={4} title="User signs the on-chain transfer">
        <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: 12 }}>
          The USDC transfer happens entirely in the user&apos;s Phantom wallet. Your app only receives the confirmed transaction signature — no private keys ever touch your server.
        </p>
        <CodeBlock
          language="ts"
          filename="lib/solana.ts"
          code={`import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { createTransferCheckedInstruction, getAssociatedTokenAddress } from "@solana/spl-token";

const USDC_MINT = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"); // devnet
const TREASURY  = new PublicKey(process.env.NEXT_PUBLIC_AURON_TREASURY!);

export async function sendUSDC(fromWallet: string, usdcAmount: number): Promise<string> {
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

  const signed    = await window.solana.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction(signature, "confirmed");
  return signature;
}`}
        />
      </Step>

      <Step n={5} title="Submit for settlement">
        <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: 12 }}>
          Pass the confirmed signature to Auron. It verifies on-chain and triggers a Razorpay UPI payout to the merchant.
        </p>
        <CodeBlock
          language="ts"
          code={`const res = await fetch("https://auron-mocha.vercel.app/api/v1/pay", {
  method:  "POST",
  headers: { "Content-Type": "application/json", "x-api-key": process.env.AURON_API_KEY! },
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
          Always generate a fresh <code>idempotencyKey</code> per payment attempt. On retry, reuse the same key — Auron returns the original result instead of triggering a duplicate payout.
        </Callout>
      </Step>

      <h2>Next steps</h2>
      <ul>
        <li><a href="/docs/how-it-works">How It Works</a> — understand the full settlement pipeline</li>
        <li><a href="/docs/sdk">SDK Reference</a> — all methods and return types</li>
        <li><a href="/docs/examples">Examples</a> — complete e-commerce checkout integration</li>
      </ul>

      <PageNav />
    </div>
  );
}
