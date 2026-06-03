import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "crypto";
import { handleKycWebhook } from "@/lib/kyc";

// Sumsub signs every webhook with HMAC-SHA256
function verifySumsubSignature(body: string, signature: string): boolean {
  const secret = process.env.SUMSUB_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return expected === signature;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const provider = req.nextUrl.searchParams.get("provider") ?? "sumsub";

  // Verify signature
  if (provider === "sumsub") {
    const sig = req.headers.get("x-payload-digest") ?? "";
    if (!verifySumsubSignature(rawBody, sig)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  await handleKycWebhook(provider, payload);
  return NextResponse.json({ ok: true });
}
