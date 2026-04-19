import { NextRequest, NextResponse } from "next/server";
import argon2 from "argon2";

/**
 * POST /api/hash-pin
 *
 * SECURITY CRITICAL: Server-side PIN hashing with argon2.
 *
 * Never hash PINs client-side. This endpoint ensures:
 * 1. Plain PIN never stored in logs or localStorage
 * 2. Argon2 parameters are consistent and strong
 * 3. Hash is impossible to reverse
 *
 * Request: { pin: "1234" }
 * Response: { hash: "argon2id$v=19$..." }
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pin } = body as { pin?: string };

    // ── Input validation ────────────────────────────────────────
    if (!pin || typeof pin !== "string") {
      return NextResponse.json(
        { error: "PIN is required and must be a string" },
        { status: 400 }
      );
    }

    // PIN must be exactly 4 digits
    if (!/^\d{4}$/.test(pin)) {
      return NextResponse.json(
        { error: "PIN must be exactly 4 digits" },
        { status: 400 }
      );
    }

    // ── Hash with argon2 ───────────────────────────────────────
    // Using argon2id (recommended by OWASP) with strong parameters
    const hash = await argon2.hash(pin, {
      type: argon2.argon2id,
      memoryCost: 65536,    // 64 MB
      timeCost: 3,          // 3 iterations
      parallelism: 4,       // 4 parallel threads
      hashLen: 32,          // 32 bytes output
      saltLength: 16,       // 16 bytes random salt
    });

    // ── Return hash (never the plain PIN) ──────────────────────
    return NextResponse.json(
      { hash },
      {
        status: 200,
        headers: {
          // Prevent caching of sensitive response
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        },
      }
    );

  } catch (err) {
    console.error("[hash-pin error]", err instanceof Error ? err.message : "Unknown");

    return NextResponse.json(
      { error: "Failed to hash PIN. Please try again." },
      { status: 500 }
    );
  }
}

// GET not allowed
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 }
  );
}
