import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getKycState } from "@/lib/kyc";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const state = await getKycState(user.id);
  return NextResponse.json(state);
}
