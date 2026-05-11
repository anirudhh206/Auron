/**
 * GET /actions.json
 *
 * Solana Actions (Blinks) manifest — tells blink-aware clients
 * (X/Twitter, Dialect, Phantom, Solana Wallet) that this domain
 * supports Solana Actions and maps URL patterns to action endpoints.
 *
 * Spec: https://docs.dialect.to/documentation/solana-actions/specification
 */

import { NextResponse } from "next/server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function GET() {
  return NextResponse.json(
    {
      rules: [
        {
          pathPattern: "/api/actions/**",
          apiPath: "/api/actions/**",
        },
        {
          pathPattern: "/pay/**",
          apiPath: "/api/actions/pay/**",
        },
      ],
    },
    { headers: CORS }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
