import type { Metadata } from "next";
import CodeBlock from "@/components/CodeBlock";
import Callout   from "@/components/Callout";
import PageNav   from "@/components/PageNav";

export const metadata: Metadata = { title: "Examples" };

export default function Examples() {
  return (
    <div className="prose">
      <p className="text-xs uppercase tracking-widest mb-4" style={{ color: "var(--text-subtle)", letterSpacing: "0.1em" }}>
        Examples
      </p>
      <h1>Examples</h1>
      <p style={{ color: "var(--text-muted)" }}>
        Real integration patterns you can copy directly into your project.
      </p>

      <hr />

      <h2>E-commerce checkout</h2>
      <p>
        A standalone Next.js store demonstrating the full payment flow: product listing → Phantom connect → USDC quote → on-chain transfer → Solscan confirmation. The demo is live at{" "}
        <a href="https://github.com/anirudhh206/auron" target="_blank" rel="noopener noreferrer">
          github.com/anirudhh206/auron
        </a>.
      </p>

      <h3>Project layout</h3>
      <CodeBlock
        language="bash"
        code={`ecommerce-checkout/
├── lib/
│   ├── auron.ts       # AuronClient + submitPayment() helper
│   ├── solana.ts      # connectPhantom(), sendUSDC(), solscanUrl()
│   └── products.ts    # product catalog type + data
├── components/
│   └── AuronCheckout.tsx   # 8-state payment machine
└── app/
    ├── page.tsx             # store listing (Zara-style grid)
    └── checkout/page.tsx    # split checkout layout`}
      />

      <h3>Payment state machine</h3>
      <p>
        The checkout component cycles through 8 states — each renders different UI with no loading spinners layered over content.
      </p>
      <CodeBlock
        language="ts"
        code={`type Step =
  | "idle"        // amount + Pay button
  | "connecting"  // Phantom connection pending
  | "quoting"     // fetching live USDC rate
  | "confirming"  // user reviews invoice (60 s countdown)
  | "sending"     // waiting for wallet signature
  | "settling"    // Auron verifying on-chain
  | "done"        // receipt + Solscan link
  | "error";      // error message + retry button`}
      />

      <h3>Human wallet flow — no API key</h3>
      <p>
        The demo submits payments without an <code>x-api-key</code> header, which triggers Auron&apos;s human wallet mode.
      </p>
      <CodeBlock
        language="ts"
        filename="lib/auron.ts"
        code={`export async function submitPayment(body: { ... }) {
  const res = await fetch(\`\${BASE_URL}/api/v1/pay\`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    // No x-api-key → human wallet flow, passes through
    body:    JSON.stringify(body),
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}`}
      />

      <Callout type="info">
        In human wallet mode there is no daily spend limit. For production high-volume flows, use an API key and set a <code>dailyLimitInr</code> on the key row to cap exposure.
      </Callout>

      <hr />

      <h2 id="agent">AI agent integration</h2>
      <p>
        Auron is designed for AI agents to initiate payments programmatically. The SDK works in server-side Node.js — an agent can get a quote, confirm intent with the user, and submit the transaction signature with no browser interaction.
      </p>

      <h3>Claude tool use example</h3>
      <CodeBlock
        language="ts"
        filename="tools/auron-pay.ts"
        code={`import Anthropic from "@anthropic-ai/sdk";
import { AuronClient } from "@auron-solana/sdk";

const claude = new Anthropic();
const auron  = new AuronClient({
  apiKey:  process.env.AURON_API_KEY!,
  baseUrl: "https://auron-mocha.vercel.app",
});

const tools = [
  {
    name: "get_payment_quote",
    description: "Get the USDC cost for an INR payment",
    input_schema: {
      type: "object",
      properties: {
        inrAmount: { type: "number", description: "INR amount to pay" },
      },
      required: ["inrAmount"],
    },
  },
];

async function paymentAgent(userMessage: string) {
  const response = await claude.messages.create({
    model:      "claude-sonnet-4-6",
    max_tokens: 1024,
    tools,
    messages:   [{ role: "user", content: userMessage }],
  });

  for (const block of response.content) {
    if (block.type === "tool_use" && block.name === "get_payment_quote") {
      const { inrAmount } = block.input as { inrAmount: number };
      return await auron.getQuote(inrAmount);
    }
  }
}`}
      />

      <h3>Daily spend limits</h3>
      <p>
        Each API key has a <code>dailyLimitInr</code> field in the <code>api_keys</code> table. Agents that exceed their limit receive <code>402</code> with remaining allowance details.
      </p>
      <CodeBlock
        language="json"
        code={`{
  "error":     "Daily spend limit exceeded",
  "limit":     50000,
  "spent":     50120,
  "remaining": 0,
  "resets":    "2026-06-19T00:00:00Z"
}`}
      />

      <Callout type="tip">
        For multi-agent setups, issue one API key per agent and set independent <code>dailyLimitInr</code> values. This gives you per-agent spend visibility and lets you kill a runaway agent by revoking just its key.
      </Callout>

      <PageNav />
    </div>
  );
}
