/**
 * Auron Savings Vault — Anchor program client
 *
 * Program: B5DwqnCoDrY8ezfGaZfpAnvZ4FwCtPNHk6vT5nRgFENg (devnet)
 * Two instructions:
 *   - lockSavings(amount, unlockTimestamp, label)
 *   - unlockSavings()
 *
 * The vault is a PDA keyed by [b"vault", owner_pubkey].
 * USDC is held in an associated token account owned by the vault PDA —
 * neither Auron nor anyone else can touch it until the clock says so.
 */

import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

// ─── Program constants ────────────────────────────────────────────────────────

export const SAVINGS_VAULT_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_SAVINGS_VAULT_PROGRAM_ID ??
  "B5DwqnCoDrY8ezfGaZfpAnvZ4FwCtPNHk6vT5nRgFENg" // devnet default
);

// devnet USDC (spl-token-faucet mint — matches lib/solana.ts and lib/verify-tx.ts)
const USDC_MINT_DEVNET  = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");
// mainnet USDC
const USDC_MINT_MAINNET = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

export const USDC_MINT =
  process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta"
    ? USDC_MINT_MAINNET
    : USDC_MINT_DEVNET;

// ─── PDA derivation ───────────────────────────────────────────────────────────

export function deriveVaultPDA(owner: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), owner.toBuffer()],
    SAVINGS_VAULT_PROGRAM_ID
  );
}

export async function getVaultTokenAccount(vault: PublicKey): Promise<PublicKey> {
  return getAssociatedTokenAddress(USDC_MINT, vault, true);
}

// ─── Instruction discriminators (first 8 bytes of sha256("global:<ix_name>")) ─

// anchor discriminator: sha256("global:lock_savings")[0..8]
const LOCK_SAVINGS_IX   = Buffer.from([0x5e, 0x15, 0x7e, 0x6e, 0xd2, 0x1a, 0xce, 0xa6]);
// anchor discriminator: sha256("global:unlock_savings")[0..8]
const UNLOCK_SAVINGS_IX = Buffer.from([0x5b, 0xf2, 0x4c, 0x8b, 0x94, 0x27, 0x1c, 0x3e]);

// ─── Build lockSavings transaction ───────────────────────────────────────────

export interface LockSavingsParams {
  owner: PublicKey;
  amountUsdc: number;      // human-readable USDC (e.g. 10.5)
  durationDays: number;
  label: string;
}

export async function buildLockSavingsTx(
  connection: Connection,
  params: LockSavingsParams
): Promise<Transaction> {
  const { owner, amountUsdc, durationDays, label } = params;

  const amount = BigInt(Math.round(amountUsdc * 1_000_000)); // USDC has 6 decimals
  const unlockTimestamp = BigInt(
    Math.floor(Date.now() / 1000) + durationDays * 86_400
  );

  const [vault]           = deriveVaultPDA(owner);
  const vaultToken        = await getVaultTokenAccount(vault);
  const ownerToken        = await getAssociatedTokenAddress(USDC_MINT, owner);

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({ recentBlockhash: blockhash, feePayer: owner });

  // Create vault ATA if it doesn't exist yet
  try {
    await getAccount(connection, vaultToken);
  } catch {
    tx.add(
      createAssociatedTokenAccountInstruction(
        owner, vaultToken, vault, USDC_MINT
      )
    );
  }

  // Encode instruction data: discriminator + amount (u64 LE) + unlock_ts (i64 LE) + label (string)
  const labelBuf  = Buffer.from(label, "utf8");
  const labelLen  = Math.min(labelBuf.length, 64);
  const data = Buffer.alloc(8 + 8 + 8 + 4 + labelLen);
  LOCK_SAVINGS_IX.copy(data, 0);
  data.writeBigUInt64LE(amount, 8);
  data.writeBigInt64LE(unlockTimestamp, 16);
  data.writeUInt32LE(labelLen, 24);
  labelBuf.copy(data, 28, 0, labelLen);

  tx.add({
    programId: SAVINGS_VAULT_PROGRAM_ID,
    keys: [
      { pubkey: vault,                   isSigner: false, isWritable: true  },
      { pubkey: vaultToken,              isSigner: false, isWritable: true  },
      { pubkey: ownerToken,              isSigner: false, isWritable: true  },
      { pubkey: USDC_MINT,               isSigner: false, isWritable: false },
      { pubkey: owner,                   isSigner: true,  isWritable: true  },
      { pubkey: TOKEN_PROGRAM_ID,        isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });

  return tx;
}

// ─── Build unlockSavings transaction ─────────────────────────────────────────

export async function buildUnlockSavingsTx(
  connection: Connection,
  owner: PublicKey
): Promise<Transaction> {
  const [vault]           = deriveVaultPDA(owner);
  const vaultToken        = await getVaultTokenAccount(vault);
  const ownerToken        = await getAssociatedTokenAddress(USDC_MINT, owner);

  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({ recentBlockhash: blockhash, feePayer: owner });

  tx.add({
    programId: SAVINGS_VAULT_PROGRAM_ID,
    keys: [
      { pubkey: vault,                   isSigner: false, isWritable: true  },
      { pubkey: vaultToken,              isSigner: false, isWritable: true  },
      { pubkey: ownerToken,              isSigner: false, isWritable: true  },
      { pubkey: owner,                   isSigner: true,  isWritable: true  },
      { pubkey: TOKEN_PROGRAM_ID,        isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: UNLOCK_SAVINGS_IX,
  });

  return tx;
}

// ─── Fetch vault state ────────────────────────────────────────────────────────

export interface VaultState {
  owner: string;
  mint: string;
  amount: number;         // USDC (human-readable)
  unlockTimestamp: number; // unix seconds
  createdAt: number;
  label: string;
  isUnlocked: boolean;
}

export async function fetchVaultState(
  connection: Connection,
  owner: PublicKey
): Promise<VaultState | null> {
  const [vault] = deriveVaultPDA(owner);
  const info = await connection.getAccountInfo(vault);
  if (!info) return null;

  // Deserialize: skip 8-byte discriminator
  const buf = info.data.slice(8);
  let offset = 0;

  const ownerKey = new PublicKey(buf.slice(offset, offset + 32)); offset += 32;
  const mintKey  = new PublicKey(buf.slice(offset, offset + 32)); offset += 32;
  const amount   = Number(buf.readBigUInt64LE(offset)) / 1_000_000; offset += 8;
  const unlockTs = Number(buf.readBigInt64LE(offset)); offset += 8;
  const createdAt = Number(buf.readBigInt64LE(offset)); offset += 8;
  offset += 1; // bump
  const labelLen = buf.readUInt32LE(offset); offset += 4;
  const label = buf.slice(offset, offset + labelLen).toString("utf8");

  return {
    owner:           ownerKey.toBase58(),
    mint:            mintKey.toBase58(),
    amount,
    unlockTimestamp: unlockTs,
    createdAt,
    label,
    isUnlocked:      Math.floor(Date.now() / 1000) >= unlockTs,
  };
}
