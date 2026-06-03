import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { initiateKyc } from "@/lib/kyc";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { provider = "sumsub" } = await req.json().catch(() => ({}));

  try {
    const result = await initiateKyc(user.id, provider);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "KYC initiation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
