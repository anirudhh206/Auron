import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { getAssociatedTokenAddress, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { USDC_MINT, FEE_WALLET, PLATFORM_FEE_BPS } from "./solana";

// ─── Jupiter API config ────────────────────────────────────────────────────
const JUPITER_API = "https://api.jup.ag/swap/v1";

// SOL mint address (native SOL wrapped)
const SOL_MINT = "So11111111111111111111111111111111111111112";

// ─── Types ─────────────────────────────────────────────────────────────────
export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;          // lamports / token smallest unit
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: RoutePlan[];
  contextSlot: number;
  timeTaken: number;
  // Computed helpers
  inputAmountUI: number;     // human-readable input
  outputAmountUI: number;    // human-readable output
  platformFeeUI: number;     // Auron fee in output token
  exchangeRate: number;      // output per input unit
}

interface RoutePlan {
  swapInfo: {
    ammKey: string;
    label: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    feeAmount: string;
    feeMint: string;
  };
  percent: number;
}

export type SupportedInputToken = "SOL" | "USDC";

export interface SwapParams {
  inputToken: SupportedInputToken;
  outputAmountUSDC: number;  // how much USDC the merchant should receive
  walletAddress: string;
  slippageBps?: number;      // default 50 = 0.5%
}

// ─── Get fee token account for Auron platform fee ─────────────────────────
// Jupiter deposits platform fees into a token account owned by FEE_WALLET
async function getFeeAccount(): Promise<PublicKey> {
  return getAssociatedTokenAddress(
    USDC_MINT,
    FEE_WALLET,
    false,
    TOKEN_PROGRAM_ID
  );
}

// ─── Get swap quote ────────────────────────────────────────────────────────
/**
 * Get a Jupiter swap quote.
 * Always outputs USDC (what the off-ramp needs to convert to local currency).
 * Input can be SOL or USDC (or any other supported token in future).
 */
export async function getSwapQuote(params: SwapParams): Promise<SwapQuote> {
  const { inputToken, outputAmountUSDC, slippageBps = 50 } = params;

  // USDC → USDC: no swap needed
  if (inputToken === "USDC") {
    const amount = Math.floor(outputAmountUSDC * 1_000_000);
    return {
      inputMint: USDC_MINT.toString(),
      outputMint: USDC_MINT.toString(),
      inAmount: String(amount),
      outAmount: String(amount),
      otherAmountThreshold: String(amount),
      swapMode: "ExactOut",
      slippageBps: 0,
      priceImpactPct: "0",
      routePlan: [],
      contextSlot: 0,
      timeTaken: 0,
      inputAmountUI: outputAmountUSDC,
      outputAmountUI: outputAmountUSDC,
      platformFeeUI: 0,
      exchangeRate: 1,
    };
  }

  // SOL → USDC via Jupiter
  const outputAmount = Math.floor(outputAmountUSDC * 1_000_000); // USDC 6 decimals

  const searchParams = new URLSearchParams({
    inputMint: SOL_MINT,
    outputMint: USDC_MINT.toString(),
    amount: String(outputAmount),
    swapMode: "ExactOut",         // we want exact USDC output for the merchant
    slippageBps: String(slippageBps),
    platformFeeBps: String(PLATFORM_FEE_BPS), // 0.3% Auron fee
    onlyDirectRoutes: "false",
    asLegacyTransaction: "false",
  });

  const res = await fetch(`${JUPITER_API}/quote?${searchParams.toString()}`, {
    headers: { "Accept": "application/json" },
    next: { revalidate: 0 }, // always fresh
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string }).error ?? `Jupiter quote failed: ${res.status}`
    );
  }

  const quote = await res.json() as SwapQuote;

  // Compute human-readable helpers
  const inputDecimals = inputToken === "SOL" ? 9 : 6;
  const outputDecimals = 6; // USDC always 6

  quote.inputAmountUI = Number(quote.inAmount) / 10 ** inputDecimals;
  quote.outputAmountUI = Number(quote.outAmount) / 10 ** outputDecimals;
  quote.platformFeeUI = (quote.inputAmountUI * PLATFORM_FEE_BPS) / 10_000;
  quote.exchangeRate =
    quote.inputAmountUI > 0 ? quote.outputAmountUI / quote.inputAmountUI : 0;

  return quote;
}

// ─── Build swap transaction ────────────────────────────────────────────────
/**
 * Get a serialized swap transaction from Jupiter.
 * Includes Auron's platform fee automatically via feeAccount.
 */
export async function buildSwapTransaction(
  quote: SwapQuote,
  walletAddress: string
): Promise<VersionedTransaction> {
  // No swap needed for USDC → USDC
  if (quote.inputMint === quote.outputMint) {
    throw new Error("No swap needed — input and output are the same token");
  }

  const feeAccount = await getFeeAccount();

  const res = await fetch(`${JUPITER_API}/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: walletAddress,
      wrapAndUnwrapSol: true,          // auto-wrap SOL to wSOL
      feeAccount: feeAccount.toString(), // Auron collects 0.3% here
      dynamicComputeUnitLimit: true,   // optimize compute units
      prioritizationFeeLamports: "auto", // auto-set priority fee
      asLegacyTransaction: false,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string }).error ?? `Jupiter swap build failed: ${res.status}`
    );
  }

  const { swapTransaction } = await res.json() as { swapTransaction: string };

  // Deserialize the versioned transaction
  const txBuffer = Buffer.from(swapTransaction, "base64");
  return VersionedTransaction.deserialize(txBuffer);
}

// ─── Convenience: quote and build in one call ──────────────────────────────
export async function prepareSwap(params: SwapParams): Promise<{
  quote: SwapQuote;
  transaction: VersionedTransaction | null; // null if no swap needed (USDC input)
}> {
  const quote = await getSwapQuote(params);

  if (params.inputToken === "USDC") {
    return { quote, transaction: null };
  }

  const transaction = await buildSwapTransaction(quote, params.walletAddress);
  return { quote, transaction };
}

// ─── Price fetcher (for FX rate display) ──────────────────────────────────
/**
 * Get current SOL/USDC price for display purposes.
 * Uses Jupiter's price API — free, no auth needed.
 */
export async function getSOLPrice(): Promise<number> {
  try {
    const res = await fetch(
      `https://api.jup.ag/price/v2?ids=${SOL_MINT}`,
      { next: { revalidate: 60 } } // cache for 60s
    );
    if (!res.ok) return 0;
    const data = await res.json() as {
      data: Record<string, { price: string }>;
    };
    return parseFloat(data.data[SOL_MINT]?.price ?? "0");
  } catch {
    return 0;
  }
}
