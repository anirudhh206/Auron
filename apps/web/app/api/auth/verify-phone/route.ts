/**
 * POST /api/auth/verify-phone
 *
 * Called AFTER the client-side Supabase OTP verification succeeds.
 * Writes the verified phone number + timestamp into our users table.
 *
 * Supabase OTP flow (handled client-side):
 *   1. supabase.auth.updateUser({ phone })        → sends SMS
 *   2. supabase.auth.verifyOtp({ phone, token, type: 'phone_change' }) → confirms
 *   3. → this route → users table updated
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith("091")) return `+${digits.slice(1)}`;
  // International numbers (already E.164)
  if (raw.trim().startsWith("+") && digits.length >= 7) return `+${digits}`;
  return null;
}

export async function POST(req: NextRequest) {
  let body: { phone: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawPhone = (body.phone ?? "").trim();
  if (!rawPhone) {
    return NextResponse.json({ error: "phone is required" }, { status: 400 });
  }

  const e164 = normalisePhone(rawPhone);
  if (!e164) {
    return NextResponse.json(
      { error: "Invalid phone number format." },
      { status: 422 }
    );
  }

  const supabase = await createClient();

  // Confirm the caller is authenticated
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Upsert into our users table — create row if first login, update phone otherwise
  const { error: dbErr } = await supabase
    .from("users")
    .upsert(
      {
        supabase_uid:      user.id,
        phone:             e164,
        phone_verified_at: new Date().toISOString(),
      },
      { onConflict: "supabase_uid" }
    );

  if (dbErr) {
    // Unique violation = phone already registered to a different account
    if (dbErr.code === "23505") {
      return NextResponse.json(
        { error: "This phone number is already registered to another account." },
        { status: 409 }
      );
    }
    console.error("[verify-phone] DB error:", dbErr.message);
    return NextResponse.json(
      { error: "Failed to save phone number. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, phone: e164 });
}
