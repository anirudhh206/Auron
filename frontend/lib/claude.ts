import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─── Output schema ────────────────────────────────────────────────────────────
export type ActionType =
  | "transfer"
  | "stamp_agreement"
  | "lock_savings"
  | "stamp_ownership"
  | "claim_yield";

export interface ParsedAction {
  action: ActionType | null;
  amount: number | null;
  recipient: string | null;
  note: string | null;
  duration_days: number | null;
  file_hash: string | null;
  file_name: string | null;
  description: string | null;
  vault_id: string | null;
  confidence: number;
  ambiguity: string | null;
}

// ─── Deterministic system prompt (cached for cost reduction) ──────────────────
// This prompt never changes — perfect for prompt caching (5-minute TTL).
// By caching this 2KB text, we save 90% on API costs after the first call.
const SYSTEM_PROMPT = `You are a blockchain action parser for Auron — a conversational crypto app.
Your ONLY job is to extract the user's intent and return ONLY valid JSON. Never add explanation, markdown, or extra text.

Output schema (return exactly this shape):
{
  "action": "transfer" | "stamp_agreement" | "lock_savings" | "stamp_ownership" | "claim_yield" | null,
  "amount": number | null,
  "recipient": "username.init" | null,
  "note": string | null,
  "duration_days": number | null,
  "file_hash": string | null,
  "file_name": string | null,
  "description": string | null,
  "vault_id": string | null,
  "confidence": 0.0 to 1.0,
  "ambiguity": string | null
}

Action rules:
- "transfer": user wants to send money/tokens to someone
- "stamp_agreement": user wants to record a deal, IOU, agreement, or promise
- "lock_savings": user wants to save, lock, or freeze funds for a future date
- "stamp_ownership": user wants to prove they own/created a file, photo, document
- "claim_yield": user wants to claim earned interest/yield from a savings vault

Amount rules:
- Convert currency names: Rs/₹ = rupees (keep numeric value), $ = dollars (keep numeric value)
- NEVER guess amounts. If unclear, set to null and ask via ambiguity.
- duration_days: convert "3 months" = 90, "1 week" = 7, "1 year" = 365

Confidence rules:
- 0.9+ : crystal clear intent with all required fields
- 0.7-0.89: intent clear but missing some detail
- < 0.7 : ambiguous — set ambiguity to a plain English clarification question
- If confidence < 0.8, ALWAYS set ambiguity field with a short clarifying question

Recipient rules:
- If user mentions a name (e.g. "Priya"), set recipient to "priya.init" (lowercase.init)
- If user provides a full address, use it as-is

Examples:
User: "Send Rs500 to Priya" → {"action":"transfer","amount":500,"recipient":"priya.init","note":null,"duration_days":null,"file_hash":null,"file_name":null,"description":null,"confidence":0.95,"ambiguity":null}
User: "Arjun owes me 2000" → {"action":"stamp_agreement","amount":2000,"recipient":"arjun.init","note":null,"duration_days":null,"file_hash":null,"file_name":null,"description":"Arjun owes 2000","confidence":0.9,"ambiguity":null}
User: "Lock 1000 for 3 months" → {"action":"lock_savings","amount":1000,"recipient":null,"note":null,"duration_days":90,"file_hash":null,"file_name":null,"description":"3 month savings lock","confidence":0.95,"ambiguity":null}
User: "Transfer money" → {"action":"transfer","amount":null,"recipient":null,"note":null,"duration_days":null,"file_hash":null,"file_name":null,"description":null,"vault_id":null,"confidence":0.5,"ambiguity":"How much would you like to send, and to whom?"}
User: "Claim my yield" → {"action":"claim_yield","amount":null,"recipient":null,"note":null,"duration_days":null,"file_hash":null,"file_name":null,"description":null,"vault_id":null,"confidence":0.9,"ambiguity":null}
User: "Claim yield from vault-3" → {"action":"claim_yield","amount":null,"recipient":null,"note":null,"duration_days":null,"file_hash":null,"file_name":null,"description":null,"vault_id":"vault-3","confidence":0.98,"ambiguity":null}`;

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
  switch (action.action) {
    case "transfer":
      return `Send ${action.amount} to ${action.recipient ?? "recipient"}${
        action.note ? ` with note: "${action.note}"` : ""
      }.`;
    case "stamp_agreement":
      return `Record an agreement: ${action.description ?? `${action.recipient} owes ${action.amount}`}.`;
    case "lock_savings":
      return `Lock ${action.amount} for ${action.duration_days} days (until ${
        new Date(Date.now() + (action.duration_days ?? 0) * 86400 * 1000).toLocaleDateString()
      }).`;
    case "stamp_ownership":
      return `Prove you own "${action.file_name ?? "this file"}" — recorded permanently on-chain.`;
    case "claim_yield":
      return `Claim earned yield${action.vault_id ? ` from ${action.vault_id}` : " from your savings vault"}.`;
    default:
      return "Confirm this action.";
  }
}
