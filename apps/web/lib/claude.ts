import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─── Output schema ────────────────────────────────────────────────────────────
export type ActionType =
  | "transfer"
  | "transfer_sol"
  | "transfer_usdc"
  | "upi_payment"         // Pay Indian merchant via UPI — USDC → Auron treasury → OnMeta → INR
  | "stamp_agreement"
  | "lock_savings"
  | "stamp_ownership"
  | "split_payment"       // Split bill between multiple people
  | "spending_query"      // "How much did I spend this week/month?"
  | "balance_query"       // "What's my balance?"
  | "generate_pay_link";  // "Create a pay link for ₹500" → /pay/[address]?amount=500

export interface SplitRecipient {
  name: string;         // display name or identifier
  address: string;      // wallet address / .sol domain / phone
  amount: number;       // their share in INR or USDC
  amount_usdc: number;
}

export interface ParsedAction {
  action: ActionType | null;
  amount: number | null;
  amount_usdc: number | null;   // USDC-denominated amount
  recipient: string | null;
  // ── UPI payment fields ───────────────────────────────────────────────────
  upi_id: string | null;
  merchant_name: string | null;
  inr_amount: number | null;
  // ── Split payment fields ─────────────────────────────────────────────────
  split_recipients: SplitRecipient[] | null;
  split_total_inr: number | null;
  // ── Spending query fields ─────────────────────────────────────────────────
  query_period: "today" | "week" | "month" | "year" | null;
  query_category: string | null;   // "food", "transfers", "savings", etc.
  // ── Pay link fields ──────────────────────────────────────────────────────
  pay_link_note: string | null;    // note to attach to the pay link
  // ─────────────────────────────────────────────────────────────────────────
  note: string | null;
  duration_days: number | null;
  file_hash: string | null;
  file_name: string | null;
  description: string | null;
  label: string | null;
  vault_id: string | null;
  confidence: number;
  ambiguity: string | null;
  // Language detected (for multi-language support)
  detected_language: string | null;
}

// ─── System prompt — loaded from env var (never committed to git) ─────────────
// Store the actual prompt in CLAUDE_SYSTEM_PROMPT env var:
//   • Locally  → .env.local
//   • Vercel   → Project Settings → Environment Variables
// The file you are reading has no secret content — safe to deploy.
if (!process.env.CLAUDE_SYSTEM_PROMPT) {
  console.warn("[claude] CLAUDE_SYSTEM_PROMPT env var is not set. parseIntent will return null actions.");
}
const SYSTEM_PROMPT = process.env.CLAUDE_SYSTEM_PROMPT ?? "";

/**
 * parseIntent — Parse user's plain English intent into a structured action.
 *
 * Uses prompt caching to reduce costs:
 * - System prompt is cached (never changes)
 * - Only user message is new per request
 * - Cache TTL: 5 minutes
 * - Cost: 25% of input, 100% of output (vs 100% both without cache)
 *
 * In production with ~1000 requests/minute per user:
 * - Without caching: $X per minute
 * - With caching: $X * 0.1 per minute (90% savings)
 */
export async function parseIntent(message: string): Promise<ParsedAction> {
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        } as Anthropic.Messages.TextBlockParam & { cache_control: { type: "ephemeral" } },
      ],
      messages: [
        {
          role: "user",
          content: message,
        },
      ],
    });

    // Log cache performance (useful for monitoring)
    const usage = response.usage;
    if ("cache_creation_input_tokens" in usage && typeof usage.cache_creation_input_tokens === "number" && usage.cache_creation_input_tokens > 0) {
      console.log(
        `[Cache] Created: ${usage.cache_creation_input_tokens} tokens | Input: ${usage.input_tokens} | Output: ${usage.output_tokens}`
      );
    } else if ("cache_read_input_tokens" in usage && typeof usage.cache_read_input_tokens === "number" && usage.cache_read_input_tokens > 0) {
      console.log(
        `[Cache HIT] Read: ${usage.cache_read_input_tokens} tokens | Input: ${usage.input_tokens} | Output: ${usage.output_tokens}`
      );
    }

    const raw = response.content[0];
    if (raw.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    try {
      const parsed = JSON.parse(raw.text.trim()) as ParsedAction;
      return parsed;
    } catch (parseErr) {
      throw new Error(`Failed to parse Claude response as JSON: ${raw.text}`, { cause: parseErr });
    }

  } catch (err) {
    if (err instanceof Error) {
      console.error("[parseIntent error]", err.message);
      throw err;
    }
    throw new Error("Unknown error in parseIntent");
  }
}

/**
 * buildConfirmText — Generate human-readable confirmation message from parsed action
 */
export function buildConfirmText(action: ParsedAction): string {
  const fmtSOL = (n: number | null) => (n != null ? `${n} SOL` : "SOL");
  const fmtUSDC = (n: number | null) => (n != null ? `${n.toFixed(2)} USDC` : "USDC");
  const short = (r: string | null) => {
    if (!r) return "recipient";
    return r.length > 12 ? `${r.slice(0, 4)}…${r.slice(-4)}` : r;
  };

  switch (action.action) {
    case "transfer_sol":
      return `Send ${fmtSOL(action.amount)} to ${short(action.recipient)}${action.note ? ` — "${action.note}"` : ""}.`;
    case "transfer_usdc":
    case "transfer": {
      const usdc = action.amount_usdc ?? action.amount;
      return `Send ${fmtUSDC(usdc)} to ${short(action.recipient)}${action.note ? ` — "${action.note}"` : ""}.`;
    }
    case "stamp_agreement":
      return `Record on-chain: ${action.description ?? `${action.recipient} owes ${fmtUSDC(action.amount_usdc ?? action.amount)}`}.`;
    case "lock_savings": {
      const days = action.duration_days ?? 0;
      const until = new Date(Date.now() + days * 86_400_000).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
      });
      return `Lock ${fmtUSDC(action.amount_usdc ?? action.amount)} for ${days} days — unlocks ${until}.`;
    }
    case "upi_payment": {
      const inr = action.inr_amount;
      const usdc = action.amount_usdc;
      const merchant = action.merchant_name || action.upi_id?.split("@")[0] || "merchant";
      const inrStr = inr != null ? `₹${inr.toLocaleString("en-IN")}` : "amount";
      const usdcStr = usdc != null ? ` · spend ${usdc.toFixed(4)} USDC` : "";
      return `Pay ${inrStr} to ${merchant} via UPI${usdcStr}.`;
    }
    case "stamp_ownership":
      return `Prove ownership of "${action.file_name ?? "this file"}" — recorded permanently on-chain.`;
    default:
      return "Confirm this action.";
  }
}
