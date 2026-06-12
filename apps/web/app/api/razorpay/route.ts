/**
 * /api/razorpay — Server-side Razorpay Payout endpoint
 *
 * SECURITY: RAZORPAY_KEY_SECRET never leaves this server.
 * All Razorpay API calls are made server-side here.
 * The client calls this route; this route calls Razorpay.
 *
 * Pipeline:
 *   1. Validate request body
 *   2. Idempotency check (prevent duplicate payouts)
 *   3. Create Razorpay contact (recipient)
 *   4. Create Razorpay fund account (UPI address)
 *   5. Initiate payout
 *   6. Cache + return result
 */

import { NextRequest, NextResponse } from "next/server";
import { initiateRazorpayPayout } from "@/lib/razorpay";

export const runtime = "nodejs";

// ── Validation ────────────────────────────────────────────────────────────────

interface RazorpayPayoutBody {
  amount:        number;
  upiId:         string;
  recipientName: string;
  referenceId:   string;
  description:   string;
}

function validate(body: unknown):
  | { ok: true;  data: RazorpayPayoutBody }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Body must be a JSON object" };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.amount        !== "number" || b.amount <= 0)
    return { ok: false, error: "amount must be a positive number (INR)" };
  if (typeof b.upiId         !== "string" || !b.upiId.includes("@"))
    return { ok: false, error: "upiId must be a valid UPI ID (contains @)" };
  if (typeof b.recipientName !== "string" || !b.recipientName.trim())
    return { ok: false, error: "recipientName is required" };
  if (typeof b.referenceId   !== "string" || !b.referenceId.trim())
    return { ok: false, error: "referenceId is required (idempotency key)" };
  if (typeof b.description   !== "string")
    return { ok: false, error: "description is required" };
  if (b.amount > 200_000)
    return { ok: false, error: "amount exceeds per-tx limit of ₹2,00,000" };

  return {
    ok: true,
    data: {
      amount:        b.amount as number,
      upiId:         (b.upiId         as string).trim(),
      recipientName: (b.recipientName as string).trim(),
      referenceId:   (b.referenceId   as string).trim(),
      description:   (b.description   as string).trim(),
    },
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const start = Date.now();

  // Verify Razorpay is configured verifying is razorpay credentials are avaiable or not 
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    console.error("[/api/razorpay] Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET");   // just a check for id and api key 
    return NextResponse.json(
      { error: "Razorpay not configured on server", retryable: false },
      { status: 503 }
    );
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }); }    

  const validation = validate(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { data } = validation;

  console.log(
    `[/api/razorpay] START referenceId=${data.referenceId} ` +
    `amount=₹${data.amount} upi=${data.upiId}`
  );

  const result = await initiateRazorpayPayout(data);
  const durationMs = Date.now() - start;

  if (!result.success) {
    console.error(
      `[/api/razorpay] FAILED referenceId=${data.referenceId} ` +
      `error="${result.error}" retryable=${result.retryable} durationMs=${durationMs}`
    );
    return NextResponse.json(
      {
        error:        result.error ?? "Payout failed",
        errorCode:    result.errorCode,
        retryable:    result.retryable ?? false,
        referenceId:  data.referenceId,
        durationMs,
      },
      { status: result.retryable ? 502 : 422 }
    );
  }

  console.log(
    `[/api/razorpay] SUCCESS referenceId=${data.referenceId} ` +
    `payoutId=${result.payoutId} utr=${result.utr ?? "pending"} durationMs=${durationMs}`
  );

  return NextResponse.json({
    success:      true,
    payoutId:     result.payoutId,
    utr:          result.utr,
    status:       result.status,
    referenceId:  data.referenceId,
    durationMs,
  });
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
