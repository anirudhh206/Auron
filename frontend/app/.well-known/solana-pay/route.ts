/**
 * GET /.well-known/solana-pay
 *
 * Required by Solana Pay spec and Blinks registry validation.
 * Tells any Blink-aware client (Phantom, X/Twitter, Dialect)
 * that this domain supports Solana Actions.
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
          apiPath: "/api/actions/pay",
        },
      ],
    },
    { headers: CORS }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
