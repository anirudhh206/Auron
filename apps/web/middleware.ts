import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — never remove this
  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;

  // Protect /app — redirect unauthenticated users to /login
  if (!user && path.startsWith("/app")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Skip /login if already authenticated
  if (user && path === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/app";
    return NextResponse.redirect(url);
  }

  // KYC gate: redirect authenticated users to /kyc if not yet verified.
  // Devnet bypasses KYC so developers can test without going through verification.
  // /kyc itself and all API/static routes are exempt.
  const isDevnet = process.env.NEXT_PUBLIC_SOLANA_NETWORK === "devnet";
  const kycExempt = path.startsWith("/kyc") || path.startsWith("/api") || path.startsWith("/_next");

  if (user && !isDevnet && path.startsWith("/app") && !kycExempt) {
    const { data: userRow } = await supabase
      .from("users")
      .select("kyc_status")
      .eq("supabase_uid", user.id)
      .single();

    const kycStatus = userRow?.kyc_status ?? "unverified";

    if (kycStatus !== "approved") {
      const url = request.nextUrl.clone();
      url.pathname = "/kyc";
      url.searchParams.set("status", kycStatus);
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Run on all routes except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
