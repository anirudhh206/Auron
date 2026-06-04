/**
 * POST /api/webhooks/onmeta — OnMeta Payout Webhook
 *
 * OnMeta calls this endpoint to confirm payout state changes.
 * Writes directly to Supabase so confirmation persists across
 * all Vercel invocations (replaces the previous in-memory store).
 *
 * Events handled:
 *   payout.completed  — UTR received → mark settlement + transaction completed
 *   payout.failed     — mark settlement failed, trigger worker fallback
 *   payout.processing — informational only, no state change
 *
 * Security:
 *   HMAC-SHA256 signature verified when ONMETA_WEBHOOK_SECRET is set.
 *   In demo mode (secret not set) the check is skipped with a warning.
 *
 * Idempotency:
 *   If the settlement is already in a terminal state (completed / failed)
 *   the handler returns 200 without writing — safe to retry.
 */

import { NextRequest, NextResponse }       from "next/server";
import crypto                              from "crypto";
import {
  getTransactionWithSettlement,
  updateSettlement,
  transitionTransaction,
}                                          from "@/lib/db/ledger";

export const runtime = "nodejs";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OnMetaWebhookPayload {
  event:        "payout.completed" | "payout.failed" | "payout.processing";
  payout_id:    string;
  reference_id: string;   // our paymentId (sent as reference_id in the request)
  internal_id?: string;   // same as reference_id — OnMeta sends both fields
  utr:          string | null;
  status:       string;
  amount_inr:   number;
  amount_usdc:  number;
  upi_id:       string;
  timestamp:    string;
}

// Terminal settlement states — no further writes needed
const TERMINAL_SETTLEMENT = new Set(["completed", "failed"]);
const TERMINAL_TRANSACTION = new Set(["completed", "failed"]);

// ── HMAC verification ─────────────────────────────────────────────────────────

function verifyHmac(rawBody: string, signature: string, secret: string): boolean {
  try {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    // Constant-time comparison prevents timing attacks
    const a = Buffer.from(signature, "hex");
    const b = Buffer.from(expected,  "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();

  // ── Signature verification ────────────────────────────────────────────────
  const webhookSecret = process.env.ONMETA_WEBHOOK_SECRET;
  if (webhookSecret) {
    const sig = req.headers.get("x-onmeta-signature") ?? "";
    if (!sig) {
      console.warn("[webhook/onmeta] Missing x-onmeta-signature header — rejecting");
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }
    if (!verifyHmac(rawBody, sig, webhookSecret)) {
      console.warn("[webhook/onmeta] Invalid HMAC signature — possible spoofing attempt");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else {
    console.warn("[webhook/onmeta] ONMETA_WEBHOOK_SECRET not set — signature check skipped (demo mode)");
  }

  // ── Parse payload ─────────────────────────────────────────────────────────
  let payload: OnMetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as OnMetaWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // OnMeta sends paymentId in either internal_id or reference_id
  const paymentId = (payload.internal_id ?? payload.reference_id)?.trim();
  if (!paymentId) {
    console.error("[webhook/onmeta] No paymentId in payload — cannot process");
    return NextResponse.json({ error: "Missing paymentId" }, { status: 400 });
  }

  console.log(
    `[webhook/onmeta] event=${payload.event} payoutId=${payload.payout_id} ` +
    `paymentId=${paymentId} utr=${payload.utr ?? "pending"} inr=₹${payload.amount_inr}`
  );

  // ── Informational events — no state change ────────────────────────────────
  if (payload.event === "payout.processing") {
    console.log(`[webhook/onmeta] ⏳ PROCESSING paymentId=${paymentId} — no action needed`);
    return NextResponse.json({ received: true, paymentId, event: payload.event });
  }

  // ── Load transaction + settlement from DB ─────────────────────────────────
  const txnResult = await getTransactionWithSettlement(paymentId);
  if (!txnResult.ok) {
    // Could be a webhook for a payment not yet in our DB (race condition on very
    // fast payouts). Return 200 so OnMeta doesn't retry indefinitely — the
    // settlement worker will reconcile when it next runs.
    console.warn(
      `[webhook/onmeta] Transaction not found for paymentId=${paymentId} — ` +
      `acknowledging without writing (worker will reconcile)`
    );
    return NextResponse.json({ received: true, paymentId, event: payload.event });
  }

  const { settlement, ...txn } = txnResult.data;

  // ── Idempotency guard — skip if already terminal ──────────────────────────
  if (
    TERMINAL_TRANSACTION.has(txn.status) &&
    (!settlement || TERMINAL_SETTLEMENT.has(settlement.status))
  ) {
    console.log(
      `[webhook/onmeta] Already terminal — txn.status=${txn.status} ` +
      `settlement.status=${settlement?.status ?? "none"} — skipping`
    );
    return NextResponse.json({ received: true, paymentId, event: payload.event, skipped: true });
  }

  // ── Handle payout.completed ───────────────────────────────────────────────
  if (payload.event === "payout.completed") {
    const utr = payload.utr?.trim() || null;

    if (!utr) {
      console.warn(`[webhook/onmeta] payout.completed without UTR for paymentId=${paymentId} — treating as processing`);
      return NextResponse.json({ received: true, paymentId, event: payload.event });
    }

    // Update settlement row
    if (settlement) {
      await updateSettlement(settlement.id, {
        status:             "completed",
        utr,
        provider_payout_id: payload.payout_id,
        last_checked_at:    new Date(),
        raw_response: {
          event:        payload.event,
          payout_id:    payload.payout_id,
          utr,
          amount_inr:   payload.amount_inr,
          amount_usdc:  payload.amount_usdc,
          upi_id:       payload.upi_id,
          timestamp:    payload.timestamp,
        },
      });
    }

    // Transition transaction to completed if not already
    if (!TERMINAL_TRANSACTION.has(txn.status)) {
      await transitionTransaction(txn.id, "completed", {
        reason: `onmeta webhook: payout.completed payoutId=${payload.payout_id} utr=${utr}`,
      });
    }

    console.log(
      `[webhook/onmeta] ✅ CONFIRMED paymentId=${paymentId} ` +
      `payoutId=${payload.payout_id} utr=${utr}`
    );
    return NextResponse.json({ received: true, paymentId, event: payload.event, utr });
  }

  // ── Handle payout.failed ──────────────────────────────────────────────────
  if (payload.event === "payout.failed") {
    // Update settlement row
    if (settlement) {
      await updateSettlement(settlement.id, {
        status:             "failed",
        provider_payout_id: payload.payout_id,
        last_checked_at:    new Date(),
        raw_response: {
          event:      payload.event,
          payout_id:  payload.payout_id,
          status:     payload.status,
          amount_inr: payload.amount_inr,
          timestamp:  payload.timestamp,
        },
      });
    }

    // Only transition transaction if not already terminal
    // (the settlement worker may switch to PATH B — don't kill the transaction yet
    //  unless this is the fallback provider too)
    const isAlreadyFallback = txn.provider === "treasury_razorpay" ||
                              txn.fallback_provider === null;

    if (!TERMINAL_TRANSACTION.has(txn.status) && isAlreadyFallback) {
      await transitionTransaction(txn.id, "failed", {
        reason:          `onmeta webhook: payout.failed payoutId=${payload.payout_id}`,
        errorMessage:    `OnMeta payout failed — status: ${payload.status}`,
        failureCategory: "offramp_rejected",
      });
    }

    console.error(
      `[webhook/onmeta] ❌ FAILED paymentId=${paymentId} ` +
      `payoutId=${payload.payout_id} status=${payload.status} ` +
      `fallback_available=${!isAlreadyFallback}`
    );
    return NextResponse.json({ received: true, paymentId, event: payload.event });
  }

  // Unknown event — acknowledge to stop retries
  console.warn(`[webhook/onmeta] Unknown event="${payload.event}" paymentId=${paymentId}`);
  return NextResponse.json({ received: true, paymentId, event: payload.event });
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
