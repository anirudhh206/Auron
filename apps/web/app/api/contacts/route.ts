import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getContacts, getAuronNetworkCount } from "@/lib/contacts";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [contacts, auronCount] = await Promise.all([
    getContacts(user.id),
    getAuronNetworkCount(user.id),
  ]);

  return NextResponse.json({ contacts, auronNetworkCount: auronCount });
}
