/**
 * Streamflow Finance — On-Chain Timelock Integration
 *
 * Replaces the memo-stamp savings lock with a real Solana vault.
 * Funds are transferred to a Streamflow program-owned PDA — Auron
 * cannot touch them. Release is enforced entirely at the program level.
 *
 * Program IDs (audited, immutable):
 *   Mainnet: strmRqUCoQUgGUan5YhzUZa6KqdzwX5L6FpUxfmKg5m
 *   Devnet:  HqDGZjaVRXJ9MGRQEw7qDc2rAr6iH1n1kAQdCZaCMfMZ
 *
 * Docs: https://docs.streamflow.finance
 */

import { getBN, StreamflowSolana, Types } from "@streamflow/stream";
import { NETWORK, USDC_MINT } from "./solana";

// ─── Constants ────────────────────────────────────────────────────────────────

const STREAMFLOW_CLUSTER: "devnet" | "mainnet" =
  NETWORK === "mainnet-beta" ? "mainnet" : "devnet";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LockParams {
  amountUsdc: number;
  durationDays: number;
  label: string;
  ownerAddress: string; // user's wallet — only they get the funds back
}

export interface LockResult {
  contractId: string;   // Streamflow PDA address — the actual vault on-chain
  txSignature: string;  // Solana tx that created the lock
  unlockAt: Date;       // exact unlock timestamp
  amountUsdc: number;
  label: string;
  explorerUrl: string;  // solscan link
}

export interface LockStatus {
  contractId: string;
  amountUsdc: number;
  unlockAt: Date;
  isUnlocked: boolean;
  withdrawn: boolean;
  label: string;
}

// ─── Client factory ───────────────────────────────────────────────────────────

function getStreamflowClient(rpcUrl: string): StreamflowSolana.SolanaStreamClient {
  return new StreamflowSolana.SolanaStreamClient(rpcUrl, STREAMFLOW_CLUSTER);
}

// ─── Create timelock ──────────────────────────────────────────────────────────
// Transfers USDC from user's wallet into a Streamflow vault PDA.
// The vault releases 100% at the cliff date — nothing before.
// Neither Auron nor the user can unlock early (cancelableBySender: false).
export async function createSavingsLock(
  params: LockParams,
  wallet: Types.ITransactionSigner,
  rpcUrl: string
): Promise<LockResult> {
  const { amountUsdc, durationDays, label, ownerAddress } = params;

  if (amountUsdc <= 0) throw new Error("Lock amount must be greater than zero");
  if (durationDays < 1) throw new Error("Duration must be at least 1 day");

  const client = getStreamflowClient(rpcUrl);

  const nowSeconds = Math.floor(Date.now() / 1000);
  const cliffTimestamp = nowSeconds + durationDays * 86_400;
  const amountBN = getBN(amountUsdc, 6); // USDC = 6 decimals

  const createParams: Types.ICreateStreamData = {
    recipient: ownerAddress,          // user gets their own money back at unlock
    tokenId: USDC_MINT.toString(),
    start: nowSeconds + 10,           // stream starts ~10s from now
    amount: amountBN,
    period: 1,
    cliff: cliffTimestamp,            // 100% released on this date
    cliffAmount: amountBN,
    amountPerPeriod: getBN(0, 6),     // zero drip before cliff
    name: label || "Auron Savings Lock",
    canTopup: false,
    cancelableBySender: false,        // Auron cannot touch it
    cancelableByRecipient: false,     // user cannot unlock early
    transferableBySender: false,
    transferableByRecipient: false,
    automaticWithdrawal: true,        // auto-releases to user on unlock date
    withdrawalFrequency: 60,
  };

  const { metadataId, txId } = await client.create(createParams, { sender: wallet });

  const cluster = NETWORK === "mainnet-beta" ? "" : "?cluster=devnet";
  const explorerUrl = `https://solscan.io/tx/${txId}${cluster}`;

  return {
    contractId: metadataId,
    txSignature: txId,
    unlockAt: new Date(cliffTimestamp * 1000),
    amountUsdc,
    label: label || "Savings Lock",
    explorerUrl,
  };
}

// ─── Fetch lock status ────────────────────────────────────────────────────────

export async function getSavingsLockStatus(
  contractId: string,
  rpcUrl: string
): Promise<LockStatus> {
  const client = getStreamflowClient(rpcUrl);
  const stream = await client.getOne({ id: contractId });

  const cliffTime = Number(stream.cliff) * 1000;
  const isUnlocked = Date.now() >= cliffTime;
  const amountUsdc = Number(stream.depositedAmount) / 1_000_000;

  return {
    contractId,
    amountUsdc,
    unlockAt: new Date(cliffTime),
    isUnlocked,
    withdrawn: stream.withdrawn.gt(getBN(0, 6)),
    label: stream.name,
  };
}

// ─── Fetch all locks for a wallet ─────────────────────────────────────────────

export async function getAllSavingsLocks(
  walletAddress: string,
  rpcUrl: string
): Promise<LockStatus[]> {
  const client = getStreamflowClient(rpcUrl);
  const streams = await client.get({
    wallet: walletAddress,
    type: Types.StreamType.All,
    direction: Types.StreamDirection.Incoming,
  });

  return streams
    .filter(([, s]) => s.name.startsWith("Auron"))
    .map(([id, s]) => {
      const cliffTime = Number(s.cliff) * 1000;
      return {
        contractId: id,
        amountUsdc: Number(s.depositedAmount) / 1_000_000,
        unlockAt: new Date(cliffTime),
        isUnlocked: Date.now() >= cliffTime,
        withdrawn: s.withdrawn.gt(getBN(0, 6)),
        label: s.name,
      };
    });
}
