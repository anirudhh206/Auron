/**
 * POST /api/treasury/credit — Manually credit INR to treasury
 *
 * Called by operator after manually converting USDC → INR and
 * loading the proceeds into Razorpay X.
 *
 * Body: { inrAmount: number, note?: string }
 * Protected by CRON_SECRET.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient }               from "@supabase/supabase-js";

export const runtime = "nodejs";

function db() {
  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, secret, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: { inrAmount?: number; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { inrAmount, note } = body;

  if (!inrAmount || typeof inrAmount !== "number" || inrAmount <= 0) {
    return NextResponse.json({ error: "inrAmount must be a positive number" }, { status: 400 });
  }

  // Fetch current state
  const { data: state, error: fetchErr } = await db()
    .from("treasury_state")
    .select("*")
    .eq("id", 1)
    .single();

  if (fetchErr || !state) {
    return NextResponse.json({ error: "Treasury state not found" }, { status: 500 });
  }

  // Credit INR to available balance
  const newAvailable = Number(state.inr_available) + inrAmount;

  const { error: updateErr } = await db()
    .from("treasury_state")
    .update({
      inr_available: newAvailable,
      updated_at:    new Date().toISOString(),
    })
    .eq("id", 1);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  console.log(
    `[treasury/credit] Credited ₹${inrAmount.toFixed(2)} to treasury. ` +
    `New available: ₹${newAvailable.toFixed(2)}. Note: ${note ?? "none"}`
  );

  return NextResponse.json({
    success:      true,
    credited:     inrAmount,
    newAvailable,
    note:         note ?? null,
  });
}
