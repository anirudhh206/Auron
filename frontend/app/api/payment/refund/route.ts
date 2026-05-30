
import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import { getConnection, USDC_MINT, isValidSolanaAddress } from "@/lib/solana";
import { buildUSDCTransferTx } from "@/lib/solana";
import bs58 from "bs58";

export const runtime = "nodejs";

// ─── Refund idempotency cache ─────────────────────────────────────────────────
const refundCache = new Map<string, RefundResult>();

interface RefundResult {
  success: boolean;
  txSignature: string | null;
  message: string;
  isDemo: boolean;
  processedAt: number;
}

// ─── Load treasury keypair ────────────────────────────────────────────────────
function loadTreasuryKeypair(): Keypair | null {
  const raw = process.env.TREASURY_KEYPAIR_BASE58;
  if (!raw) return null;
  try {
    const bytes = bs58.decode(raw);
    return Keypair.fromSecretKey(bytes);
  } catch {
    console.error("[refund] Invalid TREASURY_KEYPAIR_BASE58 — cannot load keypair");
    return null;
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body must be a JSON object" }, { status: 400 });
  }

  const {
    paymentId,
    userId,
    recipientAddress,
    usdcAmount,
    reason,
  } = body as Record<string, unknown>;

  // Validate required fields
  if (typeof paymentId !== "string" || !paymentId)
    return NextResponse.json({ error: "paymentId is required" }, { status: 400 });
  if (typeof userId !== "string" || !userId)
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  if (typeof recipientAddress !== "string" || !isValidSolanaAddress(recipientAddress))
    return NextResponse.json({ error: "recipientAddress must be a valid Solana address" }, { status: 400 });
  if (typeof usdcAmount !== "number" || usdcAmount <= 0)
    return NextResponse.json({ error: "usdcAmount must be positive" }, { status: 400 });
  if (usdcAmount > 2_500)
    return NextResponse.json({ error: "Refund amount exceeds maximum allowed" }, { status: 422 });

  console.log(`[refund] REQUEST paymentId=${paymentId} userId=${userId} usdc=${usdcAmount} reason="${reason ?? "not specified"}"`);

  // ── Idempotency ────────────────────────────────────────────────────────────
  const cached = refundCache.get(paymentId);
  if (cached) {
    console.log(`[refund] CACHE HIT paymentId=${paymentId} — already refunded`);
    return NextResponse.json({ ...cached, fromCache: true });
  }

  // ── Attempt real refund ───────────────────────────────────────────────────
  const keypair = loadTreasuryKeypair();
  const isDemo = !keypair;

  if (isDemo) {
    // Demo mode — simulate refund
    console.log(`[refund] DEMO MODE — simulating refund of ${usdcAmount} USDC to ${recipientAddress}`);
    await new Promise((r) => setTimeout(r, 800));

    const result: RefundResult = {
      success: true,
      txSignature: null,
      message: `Demo: ${usdcAmount.toFixed(6)} USDC would be refunded to your wallet within 24 hours. Auron support has been notified.`,
      isDemo: true,
      processedAt: Date.now(),
    };

    refundCache.set(paymentId, result);
    return NextResponse.json(result);
  }

  // Production refund — treasury keypair present
  try {
    const connection: Connection = getConnection();
    const from = keypair.publicKey;
    const to = new PublicKey(recipientAddress);

    const tx = await buildUSDCTransferTx(from, to, usdcAmount);
    tx.feePayer = keypair.publicKey;
    tx.sign(keypair);

    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    const latestBlockhash = await connection.getLatestBlockhash("confirmed");
    await connection.confirmTransaction(
      { signature, ...latestBlockhash },
      "confirmed"
    );

    console.log(`[refund] SUCCESS paymentId=${paymentId} signature=${signature}`);

    const result: RefundResult = {
      success: true,
      txSignature: signature,
      message: `${usdcAmount.toFixed(4)} USDC refunded to your wallet.`,
      isDemo: false,
      processedAt: Date.now(),
    };

    refundCache.set(paymentId, result);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Refund failed";
    console.error(`[refund] FAILED paymentId=${paymentId} err="${message}"`);

    return NextResponse.json(
      {
        success: false,
        txSignature: null,
        message: `Refund failed: ${message}. Please contact support with payment ID: ${paymentId}`,
        isDemo: false,
        error: message,
      },
      { status: 502 }
    );
  }
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
