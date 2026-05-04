import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
interface OnMetaWebhookPayload {
  event: "payout.completed" | "payout.failed" | "payout.processing";
  payout_id: string;
  reference_id: string;   // = our paymentId (sent as internal_id in the request)
  internal_id?: string;   // same as reference_id — OnMeta sends both
  utr: string | null;     // real NPCI bank reference number on completion
  status: string;
  amount_inr: number;
  amount_usdc: number;
  upi_id: string;
  timestamp: string;
}
export const webhookUTRStore = new Map<string, {
  utrNumber: string;
  payoutId: string;
  confirmedAt: number;
  event: string;
}>();

function verifyOnMetaSignature(rawBody: string, signature: string, secret: string): boolean {
  try {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    // timingSafeEqual prevents timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawBody = await req.text();
  const webhookSecret = process.env.ONMETA_WEBHOOK_SECRET;

  // Verify HMAC signature if secret is configured
  if (webhookSecret) {
    const signature = req.headers.get("x-onmeta-signature") ?? "";
    if (!signature) {
      console.warn("[webhook/onmeta] Missing x-onmeta-signature header");
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }
    if (!verifyOnMetaSignature(rawBody, signature, webhookSecret)) {
      console.warn("[webhook/onmeta] Invalid HMAC signature — possible spoofing attempt");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else {
    // Demo mode — log but don't reject
    console.log("[webhook/onmeta] No ONMETA_WEBHOOK_SECRET set — skipping signature check (demo mode)");
  }

  // Parse payload
  let payload: OnMetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as OnMetaWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const paymentId = payload.internal_id ?? payload.reference_id;

  console.log(
    `[webhook/onmeta] event=${payload.event} payoutId=${payload.payout_id} ` +
    `paymentId=${paymentId} utr=${payload.utr ?? "pending"} inr=₹${payload.amount_inr}`
  );

  switch (payload.event) {
    case "payout.completed": {
      if (payload.utr && paymentId) {
        webhookUTRStore.set(paymentId, {
          utrNumber: payload.utr,
          payoutId: payload.payout_id,
          confirmedAt: Date.now(),
          event: payload.event,
        });
        console.log(`[webhook/onmeta] ✅ CONFIRMED paymentId=${paymentId} utr=${payload.utr}`);
      }
      break;
    }
    case "payout.failed": {
      console.error(`[webhook/onmeta] ❌ FAILED paymentId=${paymentId} status=${payload.status}`);
      // Mark as explicitly failed so client can show refund CTA
      webhookUTRStore.set(paymentId, {
        utrNumber: "",
        payoutId: payload.payout_id,
        confirmedAt: Date.now(),
        event: payload.event,
      });
      break;
    }
    case "payout.processing": {
      console.log(`[webhook/onmeta] ⏳ PROCESSING paymentId=${paymentId}`);
      break;
    }
  }

  // OnMeta expects a 200 response to stop retrying
  return NextResponse.json({ received: true, paymentId, event: payload.event });
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
