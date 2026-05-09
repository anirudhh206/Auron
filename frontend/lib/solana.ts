import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
} from "@solana/spl-token";

// ─── Network ───────────────────────────────────────────────────────────────
export type SolanaNetwork = "mainnet-beta" | "devnet";

export const NETWORK: SolanaNetwork =
  (process.env.NEXT_PUBLIC_SOLANA_NETWORK as SolanaNetwork) ?? "devnet";

// Helius enterprise RPC — never use public RPC in production (rate-limited)
// Use || not ?? — empty string env var must also fall through to the public fallback
export const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_HELIUS_RPC_URL ||
  (NETWORK === "mainnet-beta"
    ? "https://api.mainnet-beta.solana.com"
    : "https://api.devnet.solana.com");

export function getConnection(): Connection {
  return new Connection(RPC_ENDPOINT, {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 60_000,
    disableRetryOnRateLimit: false,
  });
}

// ─── Token addresses ───────────────────────────────────────────────────────
// USDC mint — Circle's official addresses
export const USDC_MINT = new PublicKey(
  NETWORK === "mainnet-beta"
    ? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
    : "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"
);

// Auron treasury — receives platform fees from Jupiter swaps
// Set NEXT_PUBLIC_FEE_WALLET in env to your actual treasury wallet
export const FEE_WALLET = new PublicKey(
  // Use || not ?? — empty string env var must also fall through to the default
  process.env.NEXT_PUBLIC_FEE_WALLET || "11111111111111111111111111111111"
);

// 0.3% platform fee on every Jupiter swap — Auron's on-chain revenue
export const PLATFORM_FEE_BPS = 30;

// Solana Memo program — used for on-chain agreement + ownership stamps
export const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

// ─── Balance helpers ───────────────────────────────────────────────────────
export async function getSOLBalance(walletAddress: string): Promise<number> {
  const connection = getConnection();
  const pubkey = new PublicKey(walletAddress);
  const lamports = await connection.getBalance(pubkey, "confirmed");
  return lamports / LAMPORTS_PER_SOL;
}

export async function getUSDCBalance(walletAddress: string): Promise<number> {
  try {
    const connection = getConnection();
    const pubkey = new PublicKey(walletAddress);
    const ata = await getAssociatedTokenAddress(USDC_MINT, pubkey);
    const account = await getAccount(connection, ata, "confirmed");
    return Number(account.amount) / 1_000_000; // USDC = 6 decimals
  } catch (err) {
    // Account doesn't exist yet = zero balance, not an error
    if (
      err instanceof TokenAccountNotFoundError ||
      err instanceof TokenInvalidAccountOwnerError
    ) {
      return 0;
    }
    throw err;
  }
}

// ─── Transaction builders ──────────────────────────────────────────────────

/**
 * Build a native SOL transfer transaction.
 * Used when the user wants to send SOL directly.
 */
export async function buildSOLTransferTx(
  fromPubkey: PublicKey,
  toPubkey: PublicKey,
  amountSOL: number
): Promise<Transaction> {
  const connection = getConnection();
  const lamports = Math.floor(amountSOL * LAMPORTS_PER_SOL);

  if (lamports <= 0) throw new Error("Amount must be greater than zero");

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction({ blockhash, lastValidBlockHeight, feePayer: fromPubkey });
  tx.add(
    SystemProgram.transfer({ fromPubkey, toPubkey, lamports })
  );
  return tx;
}

/**
 * Build a USDC SPL token transfer transaction.
 * Automatically creates the recipient's associated token account if needed.
 */
export async function buildUSDCTransferTx(
  fromPubkey: PublicKey,
  toPubkey: PublicKey,
  amountUSDC: number
): Promise<Transaction> {
  const connection = getConnection();
  const amount = BigInt(Math.floor(amountUSDC * 1_000_000)); // 6 decimals

  if (amount <= 0n) throw new Error("Amount must be greater than zero");

  const fromATA = await getAssociatedTokenAddress(USDC_MINT, fromPubkey);
  const toATA = await getAssociatedTokenAddress(USDC_MINT, toPubkey);

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction({ blockhash, lastValidBlockHeight, feePayer: fromPubkey });

  // Create recipient ATA if it doesn't exist — pays for account rent
  try {
    await getAccount(connection, toATA, "confirmed");
  } catch (err) {
    if (
      err instanceof TokenAccountNotFoundError ||
      err instanceof TokenInvalidAccountOwnerError
    ) {
      tx.add(
        createAssociatedTokenAccountInstruction(
          fromPubkey, // payer
          toATA,      // ata to create
          toPubkey,   // owner
          USDC_MINT
        )
      );
    } else {
      throw err;
    }
  }

  tx.add(
    createTransferInstruction(fromATA, toATA, fromPubkey, amount)
  );

  return tx;
}

/**
 * Build a Memo program transaction for on-chain stamping.
 * Used for: agreement stamps, ownership proofs.
 * The memo is permanent, timestamped by the blockchain, immutable.
 */
export async function buildMemoTx(
  fromPubkey: PublicKey,
  memoData: Record<string, unknown>
): Promise<Transaction> {
  const connection = getConnection();
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const memoText = JSON.stringify({ ...memoData, app: "auron", v: 1 });
  if (memoText.length > 566) throw new Error("Memo too long (max 566 bytes)");

  const tx = new Transaction({ blockhash, lastValidBlockHeight, feePayer: fromPubkey });
  tx.add(
    new TransactionInstruction({
      programId: MEMO_PROGRAM_ID,
      keys: [{ pubkey: fromPubkey, isSigner: true, isWritable: false }],
      data: Buffer.from(memoText, "utf-8"),
    })
  );

  return tx;
}

// ─── Address utilities ─────────────────────────────────────────────────────

/**
 * Validate a Solana base58 public key string.
 * Returns true if valid, false otherwise.
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    const pubkey = new PublicKey(address);
    return PublicKey.isOnCurve(pubkey.toBytes());
  } catch {
    return false;
  }
}

export function shortAddr(address: string): string {
  if (address.length < 8) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

// ─── Explorer URLs ─────────────────────────────────────────────────────────
export function getTxExplorerUrl(signature: string): string {
  const cluster = NETWORK !== "mainnet-beta" ? `?cluster=${NETWORK}` : "";
  return `https://solscan.io/tx/${signature}${cluster}`;
}

export function getAccountExplorerUrl(address: string): string {
  const cluster = NETWORK !== "mainnet-beta" ? `?cluster=${NETWORK}` : "";
  return `https://solscan.io/account/${address}${cluster}`;
}

// ─── FX rate helpers ───────────────────────────────────────────────────────
// Auron FX rate = market rate minus our 0.7% spread
// Market rate is fetched at runtime; this is the fallback
export const FALLBACK_USDC_INR_RATE = 83.15; // market ~84.00, Auron rate ~83.15

export function usdcToINR(usdc: number, rate = FALLBACK_USDC_INR_RATE): number {
  return usdc * rate;
}

export function inrToUSDC(inr: number, rate = FALLBACK_USDC_INR_RATE): number {
  return inr / rate;
}
