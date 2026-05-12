import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import {
  buildSOLTransferTx,
  buildUSDCTransferTx,
  buildMemoTx,
  isValidSolanaAddress,
  FEE_WALLET,
  NETWORK,
} from "./solana";

// Devnet demo treasury — used when NEXT_PUBLIC_FEE_WALLET env var is not set.
// Replace this with your actual treasury address in production.
const SYSTEM_PROGRAM = "11111111111111111111111111111111";
const DEMO_TREASURY = "G2FAbFQPFa5qKXCetoFZQEvF9TdM4yE6UwqroeN9BCWQ"; // Auron devnet treasury

// ─── Action result type ────────────────────────────────────────────────────
// Solana supports both legacy Transaction and VersionedTransaction (Jupiter uses versioned)
export type SolanaTransaction = Transaction | VersionedTransaction;

export interface BuildResult {
  transaction: SolanaTransaction;
  isVersioned: boolean;
  description: string;
}

// ─── Transfer SOL ──────────────────────────────────────────────────────────
export async function buildTransferSOL(
  fromAddress: string,
  toAddress: string,
  amountSOL: number
): Promise<BuildResult> {
  if (!isValidSolanaAddress(fromAddress))
    throw new Error("Invalid sender wallet address");
  if (!isValidSolanaAddress(toAddress))
    throw new Error(`Invalid recipient address: "${toAddress}". Ask the user for their Solana wallet address.`);
  if (amountSOL <= 0)
    throw new Error("Amount must be greater than zero");

  const from = new PublicKey(fromAddress);
  const to = new PublicKey(toAddress);
  const tx = await buildSOLTransferTx(from, to, amountSOL);

  return {
    transaction: tx,
    isVersioned: false,
    description: `Transfer ${amountSOL} SOL`,
  };
}

// ─── Transfer USDC ─────────────────────────────────────────────────────────
export async function buildTransferUSDC(
  fromAddress: string,
  toAddress: string,
  amountUSDC: number
): Promise<BuildResult> {
  if (!isValidSolanaAddress(fromAddress))
    throw new Error("Invalid sender wallet address");
  if (!isValidSolanaAddress(toAddress))
    throw new Error(`Invalid recipient address: "${toAddress}". Ask the user for their Solana wallet address.`);
  if (amountUSDC <= 0)
    throw new Error("Amount must be greater than zero");

  const from = new PublicKey(fromAddress);
  const to = new PublicKey(toAddress);
  const tx = await buildUSDCTransferTx(from, to, amountUSDC);

  return {
    transaction: tx,
    isVersioned: false,
    description: `Transfer ${amountUSDC} USDC`,
  };
}

// ─── Stamp agreement on-chain ──────────────────────────────────────────────
// Uses Solana Memo program — permanent, immutable, timestamped by the chain
export async function buildAgreementStamp(
  fromAddress: string,
  description: string,
  partyB: string,
  amount: number | null,
  contentHash: string
): Promise<BuildResult> {
  if (!isValidSolanaAddress(fromAddress))
    throw new Error("Invalid sender wallet address");

  const from = new PublicKey(fromAddress);
  const tx = await buildMemoTx(from, {
    type: "agreement",
    hash: contentHash,
    party_a: fromAddress,
    party_b: partyB,
    description,
    amount: amount ?? undefined,
    network: NETWORK,
    ts: Date.now(),
  });

  return {
    transaction: tx,
    isVersioned: false,
    description: `Agreement: ${description.slice(0, 60)}`,
  };
}

// ─── Stamp file ownership on-chain ────────────────────────────────────────
// Proves you owned this file at this block timestamp — immutable proof
export async function buildOwnershipStamp(
  fromAddress: string,
  fileHash: string,
  fileName: string,
  description: string
): Promise<BuildResult> {
  if (!isValidSolanaAddress(fromAddress))
    throw new Error("Invalid sender wallet address");
  if (!fileHash)
    throw new Error("File hash is required — please attach your file first");

  const from = new PublicKey(fromAddress);
  const tx = await buildMemoTx(from, {
    type: "ownership",
    file_hash: fileHash,
    file_name: fileName,
    description,
    owner: fromAddress,
    network: NETWORK,
    ts: Date.now(),
  });

  return {
    transaction: tx,
    isVersioned: false,
    description: `Ownership proof: ${fileName}`,
  };
}

// ─── Lock savings — Auron on-chain savings vault (Anchor program) ────────────
// Funds go into a PDA vault owned by the Auron savings-vault program.
// Neither Auron nor anyone else can access them before the unlock timestamp —
// enforced at the Solana program level, not in a database.
//
// Program: SAVzVZMiYXHGXgCnLQb9vHEQWipbSxAJCeXHCEo5auN (devnet)
export async function buildSavingsLockPreview(
  fromAddress: string,
  amountUSDC: number,
  durationDays: number,
  label: string
): Promise<BuildResult> {
  if (!isValidSolanaAddress(fromAddress))
    throw new Error("Invalid sender wallet address");
  if (amountUSDC <= 0)
    throw new Error("Lock amount must be greater than zero");
  if (durationDays <= 0)
    throw new Error("Duration must be at least 1 day");

  const { buildLockSavingsTx } = await import("./savings-vault");
  const { getConnection: getRpcConnection } = await import("./solana");

  const connection = getRpcConnection();
  const owner      = new PublicKey(fromAddress);

  const tx = await buildLockSavingsTx(connection, {
    owner,
    amountUsdc: amountUSDC,
    durationDays,
    label: label.slice(0, 64),
  });

  const unlockAt = new Date(Date.now() + durationDays * 86_400_000).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });

  return {
    transaction: tx,
    isVersioned: false,
    description: `Lock ${amountUSDC} USDC for ${durationDays} days — unlocks ${unlockAt} · Auron vault on Solana`,
  };
}

// ─── UPI Payment — USDC to Auron treasury ─────────────────────────────────
// User pays USDC → Auron treasury → OnMeta converts → merchant gets INR via UPI.
// This is the core Auron off-ramp flow. Merchant needs zero crypto setup.
export async function buildUPIPayment(
  fromAddress: string,
  amountUSDC: number,
  upiId: string,
  merchantName: string,
  inrAmount: number
): Promise<BuildResult> {
  if (!isValidSolanaAddress(fromAddress))
    throw new Error("Invalid sender wallet address");
  if (amountUSDC <= 0)
    throw new Error("Amount must be greater than zero");
  if (!upiId?.trim())
    throw new Error("UPI ID is required");

  // Resolve treasury address — fall back to demo treasury on devnet if not configured
  const treasuryAddress = FEE_WALLET.toString() === SYSTEM_PROGRAM
    ? DEMO_TREASURY
    : FEE_WALLET.toString();

  if (!isValidSolanaAddress(treasuryAddress)) {
    throw new Error("Auron treasury wallet address is not configured. Set NEXT_PUBLIC_FEE_WALLET.");
  }

  const from = new PublicKey(fromAddress);
  const to = new PublicKey(treasuryAddress);
  const tx = await buildUSDCTransferTx(from, to, amountUSDC);

  return {
    transaction: tx,
    isVersioned: false,
    description: `UPI payment: ₹${inrAmount.toLocaleString("en-IN")} to ${merchantName || upiId} (${amountUSDC.toFixed(6)} USDC → Auron → OnMeta → UPI)`,
  };
}

// ─── SHA-256 hash helper (browser native) ─────────────────────────────────
export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
