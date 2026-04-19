import { NextRequest, NextResponse } from "next/server";

// Resolves a .init username to a wallet address via the Initia name registry
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");

  if (!username) {
    return NextResponse.json({ error: "username is required" }, { status: 400 });
  }

  const name = username.endsWith(".init") ? username : `${username}.init`;

  try {
    const restUrl =
      process.env.NEXT_PUBLIC_REST_URL ?? "https://rest.auron.initia.xyz";

    // Query Initia name registry
    const res = await fetch(
      `${restUrl}/initia/registry/v1/names/${encodeURIComponent(name)}`,
      { next: { revalidate: 60 } }
    );

    if (!res.ok) {
      return NextResponse.json({ resolved: false, address: null, username: name });
    }

    const data = await res.json();
    const address = data?.name?.address ?? null;

    return NextResponse.json({
      resolved: !!address,
      address,
      username: name,
    });
  } catch {
    return NextResponse.json({ resolved: false, address: null, username: name });
  }
}
