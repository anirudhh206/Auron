import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { parseIntent, buildConfirmText, ParsedAction } from "@/lib/claude";
import { detectUrgency, evaluateAmount, SecurityFlag } from "@/lib/security";

/**
 * POST /api/parse-intent
 *
 * Core intent parsing pipeline with production-grade rate limiting.
 *
 * Security layers:
 * 1. Rate limiting (Vercel KV) — 10 requests per 60 seconds per user
 * 2. Intent parsing (Claude API with prompt caching) — confidence threshold 0.8
 * 3. Urgency detection — scam prevention
 * 4. Amount evaluation — spend ceiling checks
 *
 * Response types:
 * - "action" — ready to execute
 * - "clarification" — AI needs more info
 * - error — something went wrong
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, userId, spendCeiling, thirtyDayAvg, isNewRecipient } = body as {
      message: string;
      userId: string;
      spendCeiling?: number;
      thirtyDayAvg?: number;
      isNewRecipient?: boolean;
    };

    if (!message || typeof message !== "string") {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    const messageLength = message.length;
    if (messageLength > 500) {
      return NextResponse.json(
        { error: "Message too long (max 500 characters)" },
        { status: 400 }
      );
    }

    // ── Layer 1: Rate limiting (Vercel KV) ─────────────────────────────────
    const rateLimitKey = `auron:ratelimit:${userId ?? "anonymous"}`;
    const rateLimitTtl = 60; // 60 second window

    try {
      const current = await kv.incr(rateLimitKey);

      // Set TTL on first request
      if (current === 1) {
        await kv.expire(rateLimitKey, rateLimitTtl);
      }

      // 10 requests per 60 seconds max
      if (current > 10) {
        return NextResponse.json(
          { error: "Too many requests. Please wait a moment." },
          { status: 429, headers: { "Retry-After": String(rateLimitTtl) } }
        );
      }
    } catch (kvErr) {
      // KV error shouldn't block request — log and continue
      console.error("[KV Rate Limit Error]", kvErr instanceof Error ? kvErr.message : "Unknown");
    }

    // ── Layer 2: Parse intent with Claude (with prompt caching) ─────────────
    let action: ParsedAction;
    try {
      action = await parseIntent(message);
    } catch (parseErr) {
      console.error("[Parse Intent Error]", parseErr instanceof Error ? parseErr.message : "Unknown");
      return NextResponse.json(
        { error: "Failed to understand your request. Please try again." },
        { status: 500 }
      );
    }

    // ── Layer 3: Confidence check — return clarification if low ─────────────
    if (action.confidence < 0.8 && action.ambiguity) {
      return NextResponse.json({
        type: "clarification",
        question: action.ambiguity,
        action: null,
        securityFlags: [],
        confirmText: null,
        requiresSlowdown: false,
      });
    }

    // ── Security evaluation ────────────────────────────────────────────────
    const securityFlags: SecurityFlag[] = [];
    let requiresSlowdown = false;

    // Layer 3: Urgency detector (scam prevention)
    if (detectUrgency(message)) {
      securityFlags.push({ type: "URGENCY_DETECTED", cooldownSeconds: 60 });
      requiresSlowdown = true;
    }

    // Layer 2: Smart limits (if amount-based action)
    if (action.amount && action.action === "transfer") {
      const ceiling = spendCeiling ?? 500;
      const avg = thirtyDayAvg ?? 0;
      const newRecip = isNewRecipient ?? false;
      const limitResult = evaluateAmount(action.amount, ceiling, avg, newRecip);

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

    // ── Build confirm text ─────────────────────────────────────────────────
    const confirmText = buildConfirmText(action);

    return NextResponse.json({
      type: "action",
      action,
      securityFlags,
      confirmText,
      requiresSlowdown,
    });

  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    console.error("[parse-intent]", errorMsg);

    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

// Only POST allowed
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
