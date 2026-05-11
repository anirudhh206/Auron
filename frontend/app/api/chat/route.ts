import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { kv } from "@vercel/kv";
import { detectUrgency, evaluateAmount, SecurityFlag } from "@/lib/security";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Separator between conversational reply and structured JSON
const SEP = "|||JSON|||";
const SEP_LEN = SEP.length;

// ─── System prompt (cached — never changes) ────────────────────────────────
const SYSTEM_PROMPT = `You are Auron's AI assistant — a conversational Solana blockchain interface. You help users send SOL or USDC, lock savings, record agreements, and prove file ownership through plain natural language.

RESPONSE FORMAT (strictly required — no exceptions):
Your ENTIRE response must be exactly two parts in this exact order:

PART 1 — Conversational reply (1-2 sentences max, friendly, present tense):
Directly acknowledge what you understood. If you need clarification, ask exactly ONE short question.
✓ "Sending ₹500 to Priya — I'll need their Solana wallet address."
✓ "I'll lock 20 USDC for 3 months on-chain."
✓ "How much would you like to send, and do you have their Solana wallet address?"
✗ No bullet points. No lengthy explanations. No markdown.

PART 2 — Action JSON (ALWAYS the very last line, prefixed with ${SEP}):
${SEP}{"action":"transfer"|"transfer_sol"|"transfer_usdc"|"upi_payment"|"stamp_agreement"|"lock_savings"|"stamp_ownership"|null,"amount":number|null,"amount_usdc":number|null,"recipient":string|null,"upi_id":string|null,"merchant_name":string|null,"inr_amount":number|null,"note":string|null,"duration_days":number|null,"file_hash":string|null,"file_name":string|null,"description":string|null,"label":string|null,"confidence":0.0-1.0,"ambiguity":string|null}

ACTION RULES:
- "transfer_sol": user wants to send SOL specifically
- "transfer_usdc": user wants to send USDC specifically
- "transfer": user wants to send money but token not specified (ask to clarify, or default to USDC)
- "upi_payment": user is paying an Indian merchant via UPI QR or UPI ID (e.g. "Pay ₹450 to merchant@paytm", "Pay to merchant via UPI ID xyz@upi")
  → USDC goes to Auron treasury; Auron's off-ramp sends INR to the merchant's UPI ID instantly
  → Extract: upi_id (the UPI ID e.g. "merchant@paytm"), merchant_name (display name), inr_amount (₹ value as number), amount_usdc (inr_amount / 83.15, rounded to 6 decimal places)
  → Do NOT set recipient field for upi_payment (treasury address is handled server-side)
  → If inr_amount is missing, set ambiguity to ask how much to pay
- "stamp_agreement": user wants to record a deal, IOU, promise, or debt on-chain
- "lock_savings": user wants to save/lock/freeze funds for a future date
- "stamp_ownership": user wants to prove ownership of a file, photo, or document
- null: you need more info — put your clarifying question in the "ambiguity" field

AMOUNT RULES:
- ₹ / Rs / rupees → convert to USDC using 1 USDC = ₹83.15 (round to 6 decimal places), set amount_usdc. Also set inr_amount to the original ₹ value.
- SOL amounts → set amount field
- USDC amounts → set amount_usdc field
- Never guess amounts. If unclear → null + set ambiguity.
- duration_days: "3 months"=90, "1 week"=7, "6 months"=180, "1 year"=365, "2 years"=730

RECIPIENT RULES:
- For "upi_payment": set upi_id and merchant_name. Do NOT set recipient.
- For all other transfers: recipient can be ANY of these — set it exactly as the user provided:
    a) Solana wallet address (base58, 32–44 chars)  e.g. "7xKXtg2CW87d97TX..."
    b) .sol domain                                   e.g. "priya.sol"
    c) Indian phone number                           e.g. "9876543210" or "+919876543210"
- If the user gives a .sol domain → set recipient to the full domain ("priya.sol"), confidence 0.95
- If the user gives a phone number → set recipient to the number as-is, confidence 0.95
- If the user gives only a first name with no other identifier → confidence 0.65, set ambiguity to "What is [Name]'s Solana wallet address, .sol domain, or phone number?"
- Never invent or guess addresses, domains, or phone numbers

CONFIDENCE RULES:
- 0.95+ : all required fields present, crystal clear
- 0.7-0.94 : intent clear but minor detail missing (e.g. missing recipient address)
- < 0.7 : ambiguous — ALWAYS set ambiguity field with a question

LANGUAGE RULES:
- Respond in the SAME language the user writes in (Hindi, English, Hinglish, etc.)
- The JSON is always in English regardless of user language

CONTEXT: You have conversation history. Use it. "Same person" = last recipient. "Actually make it 1000" = update last amount.

EXAMPLE 1 — wallet address:
User: "Send 0.5 SOL to 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAs7"
Correct response:
Sending 0.5 SOL — confirming the details below.
${SEP}{"action":"transfer_sol","amount":0.5,"amount_usdc":null,"recipient":"7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAs7","note":null,"duration_days":null,"file_hash":null,"file_name":null,"description":null,"label":null,"confidence":0.98,"ambiguity":null}

EXAMPLE 2 — .sol domain:
User: "Send ₹500 to priya.sol"
Correct response:
Sending ₹500 (~6 USDC) to priya.sol — confirming below.
${SEP}{"action":"transfer_usdc","amount":null,"amount_usdc":6.01,"recipient":"priya.sol","upi_id":null,"merchant_name":null,"inr_amount":500,"note":null,"duration_days":null,"file_hash":null,"file_name":null,"description":null,"label":null,"confidence":0.95,"ambiguity":null}

EXAMPLE 3 — phone number:
User: "Send ₹200 to 9876543210"
Correct response:
Sending ₹200 (~2.41 USDC) to 9876543210 — I'll look them up on Auron.
${SEP}{"action":"transfer_usdc","amount":null,"amount_usdc":2.41,"recipient":"9876543210","upi_id":null,"merchant_name":null,"inr_amount":200,"note":null,"duration_days":null,"file_hash":null,"file_name":null,"description":null,"label":null,"confidence":0.95,"ambiguity":null}

EXAMPLE 4 — name only (ask for identifier):
User: "Send ₹500 to Priya"
Correct response:
I'll need Priya's Solana wallet address, .sol domain, or phone number to send — that's roughly 6 USDC.
${SEP}{"action":"transfer_usdc","amount":null,"amount_usdc":6.01,"recipient":"Priya","note":null,"duration_days":null,"file_hash":null,"file_name":null,"description":null,"label":null,"confidence":0.65,"ambiguity":"What is Priya's Solana wallet address, .sol domain, or phone number?"}`;

// ─── Route handler ─────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  try {
    const body = await req.json();
    const {
      message,
      userId,
      history = [],
      spendCeiling,
      dailyCap,
      dailySpent,
    } = body as {
      message: string;
      userId?: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
      spendCeiling?: number;
      dailyCap?: number;
      dailySpent?: number;
    };

    // ── Input validation ──────────────────────────────────────────────────
    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "message is required" }), { status: 400 });
    }
    if (message.length > 500) {
      return new Response(JSON.stringify({ error: "Message too long (max 500 characters)" }), { status: 400 });
    }

    // ── Rate limiting (Vercel KV) ─────────────────────────────────────────
    const rateLimitKey = `auron:ratelimit:chat:${userId ?? "anonymous"}`;
    try {
      const current = await kv.incr(rateLimitKey);
      if (current === 1) await kv.expire(rateLimitKey, 60);
      if (current > 12) {
        return new Response(
          JSON.stringify({ error: "Too many requests. Please wait a moment." }),
          { status: 429, headers: { "Retry-After": "60" } }
        );
      }
    } catch (kvErr) {
      // KV error must never block the user — log and continue
      console.error("[KV]", kvErr instanceof Error ? kvErr.message : "KV error");
    }

    // ── Build conversation history (last 8 turns) ─────────────────────────
    const recentHistory = history
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content }));

    // ── Create streaming Claude request ───────────────────────────────────
    const stream = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        } as Anthropic.Messages.TextBlockParam & { cache_control: { type: "ephemeral" } },
      ],
      messages: [
        ...recentHistory,
        { role: "user", content: message },
      ],
      stream: true,
    });

    // ── Transform Claude stream → SSE ReadableStream ──────────────────────
    let fullText = "";
    let lastFlushed = 0; // index up to which we've sent text chunks

    const readable = new ReadableStream({
      async start(controller) {
        function send(payload: object) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        }

        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              fullText += event.delta.text;

              const sepIdx = fullText.indexOf(SEP);

              if (sepIdx === -1) {
                // Separator not yet seen — buffer last SEP_LEN chars to avoid
                // accidentally streaming a partial separator to the client.
                const safeEnd = Math.max(0, fullText.length - SEP_LEN);
                if (safeEnd > lastFlushed) {
                  send({ type: "text", chunk: fullText.slice(lastFlushed, safeEnd) });
                  lastFlushed = safeEnd;
                }
              } else {
                // Separator found — flush any remaining display text up to it
                if (sepIdx > lastFlushed) {
                  send({ type: "text", chunk: fullText.slice(lastFlushed, sepIdx) });
                  lastFlushed = sepIdx;
                }
                // Don't stream anything after the separator
              }
            }

            if (event.type === "message_stop") {
              // Log cache performance
              if ("cache_read_input_tokens" in event) {
                const e = event as any;
                if (e.cache_read_input_tokens > 0) {
                  console.log(`[Cache HIT] Read: ${e.cache_read_input_tokens} tokens`);
                }
              }

              // Parse final response
              const sepIdx = fullText.indexOf(SEP);
              let displayText = fullText.trim();
              let actionJson: Record<string, unknown> | null = null;

              if (sepIdx !== -1) {
                displayText = fullText.slice(0, sepIdx).trim();
                const jsonStr = fullText.slice(sepIdx + SEP_LEN).trim();

                // Flush any unsent display text
                if (sepIdx > lastFlushed) {
                  send({ type: "text", chunk: fullText.slice(lastFlushed, sepIdx) });
                }

                try {
                  actionJson = JSON.parse(jsonStr);
                } catch (e) {
                  console.error("[chat] JSON parse error:", jsonStr.slice(0, 200));
                }
              } else {
                // No separator — flush remaining safe text
                if (fullText.length > lastFlushed) {
                  send({ type: "text", chunk: fullText.slice(lastFlushed) });
                }
              }

              // ── Daily cap check (transfer actions only) ───────────────
              const isTransfer = ["transfer", "transfer_sol", "transfer_usdc", "upi_payment"].includes(
                String(actionJson?.action ?? "")
              );
              const transferAmount =
                (actionJson?.amount_usdc as number | null) ??
                (actionJson?.amount as number | null) ??
                0;

              // For upi_payment, the spend amount is in USDC (amount_usdc)
              const effectiveTransferAmount = actionJson?.action === "upi_payment"
                ? (actionJson?.amount_usdc as number | null) ?? 0
                : transferAmount;

              if (
                isTransfer &&
                effectiveTransferAmount > 0 &&
                typeof dailyCap === "number" &&
                typeof dailySpent === "number"
              ) {
                if (dailySpent + effectiveTransferAmount > dailyCap) {
                  send({
                    type: "daily_cap_exceeded",
                    limit: dailyCap,
                    spent: dailySpent,
                  });
                  controller.close();
                  return;
                }
              }

              // ── Security evaluation ───────────────────────────────────
              const securityFlags: SecurityFlag[] = [];
              let requiresSlowdown = false;

              if (actionJson?.action) {
                if (detectUrgency(message)) {
                  securityFlags.push({ type: "URGENCY_DETECTED", cooldownSeconds: 60 });
                  requiresSlowdown = true;
                }

                if (isTransfer && effectiveTransferAmount > 0) {
                  const ceiling = spendCeiling ?? 500;
                  const limitResult = evaluateAmount(effectiveTransferAmount, ceiling, 0, false);
                  if (limitResult.risk === "extreme") {
                    securityFlags.push({
                      type: "EXTREME_AMOUNT",
                      holdDurationMs: limitResult.holdDurationMs,
                      requiresVoice: true,
                    });
                    requiresSlowdown = true;
                  } else if (limitResult.risk === "new_recipient_large") {
                    securityFlags.push({ type: "NEW_RECIPIENT_LARGE", previewSeconds: 60 });
                    requiresSlowdown = true;
                  } else if (limitResult.risk === "above_ceiling") {
                    securityFlags.push({
                      type: "ABOVE_CEILING",
                      holdDurationMs: limitResult.holdDurationMs,
                    });
                  }
                }
              }

              // ── Send final done event ─────────────────────────────────
              send({
                type: "done",
                displayText,
                action: actionJson,
                confirmText: actionJson ? buildConfirmText(actionJson) : null,
                securityFlags,
                requiresSlowdown,
              });

              controller.close();
            }
          }
        } catch (err) {
          console.error("[chat stream]", err instanceof Error ? err.message : err);
          send({ type: "error", message: "Stream interrupted. Please try again." });
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("[chat]", err instanceof Error ? err.message : err);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      { status: 500 }
    );
  }
}

export async function GET() {
  return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
}

// ─── Confirm text builder ──────────────────────────────────────────────────
function buildConfirmText(action: Record<string, unknown>): string {
  const fmtSOL = (n: unknown) =>
    typeof n === "number" ? `${n} SOL` : String(n ?? "");
  const fmtUSDC = (n: unknown) =>
    typeof n === "number" ? `${n.toFixed(2)} USDC` : String(n ?? "");
  const shortRecipient = (r: unknown) => {
    const s = String(r ?? "recipient");
    // .sol domain — show as-is (e.g. "priya.sol")
    if (s.endsWith(".sol")) return s;
    // Phone number — show as-is (e.g. "9876543210")
    if (/^\+?[\d\s\-().]{7,15}$/.test(s)) return s;
    // Wallet address — truncate
    return s.length > 12 ? `${s.slice(0, 4)}…${s.slice(-4)}` : s;
  };

  switch (action.action) {
    case "transfer_sol":
      return `Send ${fmtSOL(action.amount)} to ${shortRecipient(action.recipient)}${action.note ? ` — "${action.note}"` : ""}.`;

    case "transfer_usdc":
    case "transfer": {
      const usdc = action.amount_usdc ?? action.amount;
      return `Send ${fmtUSDC(usdc)} to ${shortRecipient(action.recipient)}${action.note ? ` — "${action.note}"` : ""}.`;
    }

    case "upi_payment": {
      const inr = action.inr_amount as number | null;
      const usdc = action.amount_usdc as number | null;
      const merchant = (action.merchant_name as string | null)
        || (action.upi_id as string | null)?.split("@")[0]
        || "merchant";
      const inrStr = inr != null ? `₹${Number(inr).toLocaleString("en-IN")}` : "amount";
      const usdcStr = usdc != null ? ` · ${fmtUSDC(usdc)}` : "";
      return `Pay ${inrStr} to ${merchant} via UPI${usdcStr}.`;
    }

    case "stamp_agreement":
      return `Record on-chain: ${action.description ?? `${action.recipient} owes ${fmtUSDC(action.amount_usdc ?? action.amount)}`}.`;

    case "lock_savings": {
      const days = typeof action.duration_days === "number" ? action.duration_days : 0;
      const until = new Date(Date.now() + days * 86_400_000).toLocaleDateString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
      });
      const amt = action.amount_usdc ?? action.amount;
      return `Lock ${fmtUSDC(amt)} for ${days} days — unlocks ${until}.`;
    }

    case "stamp_ownership":
      return `Prove ownership of "${action.file_name ?? "this file"}" — recorded permanently on-chain.`;

    default:
      return "Confirm this action.";
  }
}
