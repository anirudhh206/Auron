/**
 * Phantom Mobile Deep Link Protocol
 * Full connect + sign + send flow from any browser on Android
 * https://docs.phantom.app/phantom-deeplinks/provider-methods
 */

import nacl from "tweetnacl";
import bs58 from "bs58";
import { Transaction, VersionedTransaction } from "@solana/web3.js";

const PHANTOM_DEEPLINK_BASE = "https://phantom.app/ul/v1";

// ─── Session storage keys ─────────────────────────────────────────────────────
const KEY_DAPP_SECRET   = "auron_dapp_secret";
const KEY_PHANTOM_PUBKEY = "auron_phantom_pubkey";
const KEY_PHANTOM_SESSION = "auron_phantom_session";
const KEY_PENDING_ACTION  = "auron_pending_action"; // persists across redirect

// ─── dApp keypair — generated once per browser session ───────────────────────
export function getDappKeypair(): nacl.BoxKeyPair {
  if (typeof window === "undefined") return nacl.box.keyPair();

  const stored = sessionStorage.getItem(KEY_DAPP_SECRET);
  if (stored) {
    return nacl.box.keyPair.fromSecretKey(bs58.decode(stored));
  }

  const keypair = nacl.box.keyPair();
  sessionStorage.setItem(KEY_DAPP_SECRET, bs58.encode(keypair.secretKey));
  return keypair;
}

// ─── Shared secret between dApp and Phantom ───────────────────────────────────
function getSharedSecret(phantomPublicKey: string): Uint8Array {
  const dappKeypair = getDappKeypair();
  return nacl.box.before(bs58.decode(phantomPublicKey), dappKeypair.secretKey);
}

// ─── Encrypt payload for Phantom ─────────────────────────────────────────────
function encryptPayload(payload: object, sharedSecret: Uint8Array): { nonce: string; data: string } {
  const nonce = nacl.randomBytes(24);
  const encrypted = nacl.box.after(
    Buffer.from(JSON.stringify(payload)),
    nonce,
    sharedSecret
  );
  return {
    nonce: bs58.encode(nonce),
    data: bs58.encode(encrypted),
  };
}

// ─── Decrypt response from Phantom ───────────────────────────────────────────
function decryptPayload(data: string, nonce: string, sharedSecret: Uint8Array): Record<string, unknown> | null {
  try {
    const decrypted = nacl.box.open.after(
      bs58.decode(data),
      bs58.decode(nonce),
      sharedSecret
    );
    if (!decrypted) return null;
    return JSON.parse(new TextDecoder().decode(decrypted)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ─── CONNECT ──────────────────────────────────────────────────────────────────
export function buildPhantomConnectUrl(
  appUrl: string,
  cluster: "devnet" | "mainnet-beta" = "devnet"
): string {
  const dappKeypair = getDappKeypair();
  const params = new URLSearchParams({
    dapp_encryption_public_key: bs58.encode(dappKeypair.publicKey),
    cluster,
    app_url: appUrl,
    redirect_link: `${appUrl}/phantom-callback?action=connect`,
  });
  return `${PHANTOM_DEEPLINK_BASE}/connect?${params.toString()}`;
}

export interface PhantomConnectResult {
  publicKey: string;
  session: string;
}

export function handleConnectResponse(
  phantomEncryptionPublicKey: string,
  nonce: string,
  data: string
): PhantomConnectResult | null {
  try {
    const dappKeypair = getDappKeypair();
    const sharedSecret = nacl.box.before(
      bs58.decode(phantomEncryptionPublicKey),
      dappKeypair.secretKey
    );
    const decrypted = decryptPayload(data, nonce, sharedSecret);
    if (!decrypted) return null;

    const result = decrypted as unknown as PhantomConnectResult;

    // Persist session for signing
    sessionStorage.setItem(KEY_PHANTOM_PUBKEY, phantomEncryptionPublicKey);
    sessionStorage.setItem(KEY_PHANTOM_SESSION, result.session);
    sessionStorage.setItem("auron_connected_pubkey", result.publicKey);

    return result;
  } catch {
    return null;
  }
}

// ─── SIGN AND SEND TRANSACTION ────────────────────────────────────────────────
export interface PendingSignAction {
  paymentId?: string;       // for UPI payments
  confirmText: string;
  actionType: string;
  returnPath: string;       // where to go after signing
}

export function buildSignAndSendTransactionUrl(
  transaction: Transaction | VersionedTransaction,
  appUrl: string,
  pendingAction: PendingSignAction
): string | null {
  try {
    const phantomPubkey = sessionStorage.getItem(KEY_PHANTOM_PUBKEY);
    const session = sessionStorage.getItem(KEY_PHANTOM_SESSION);

    if (!phantomPubkey || !session) {
      console.error("[phantom-deeplink] No session — user must connect first");
      return null;
    }

    // Serialize the transaction
    const serialized = transaction instanceof VersionedTransaction
      ? transaction.serialize()
      : transaction.serialize({ requireAllSignatures: false, verifySignatures: false });

    const sharedSecret = getSharedSecret(phantomPubkey);

    const payload = encryptPayload(
      {
        transaction: bs58.encode(serialized),
        session,
        sendOptions: { skipPreflight: false, preflightCommitment: "confirmed" },
      },
      sharedSecret
    );

    // Persist pending action so we can restore state after redirect
    sessionStorage.setItem(KEY_PENDING_ACTION, JSON.stringify(pendingAction));

    const params = new URLSearchParams({
      dapp_encryption_public_key: bs58.encode(getDappKeypair().publicKey),
      nonce: payload.nonce,
      redirect_link: `${appUrl}/phantom-callback?action=sign`,
      payload: payload.data,
    });

    return `${PHANTOM_DEEPLINK_BASE}/signAndSendTransaction?${params.toString()}`;
  } catch (err) {
    console.error("[phantom-deeplink] Failed to build sign URL", err);
    return null;
  }
}

export function handleSignResponse(
  data: string,
  nonce: string
): { signature: string; pendingAction: PendingSignAction | null } | null {
  try {
    const phantomPubkey = sessionStorage.getItem(KEY_PHANTOM_PUBKEY);
    if (!phantomPubkey) return null;

    const sharedSecret = getSharedSecret(phantomPubkey);
    const decrypted = decryptPayload(data, nonce, sharedSecret);
    if (!decrypted) return null;

    const signature = decrypted.signature as string;

    // Restore pending action
    const pendingRaw = sessionStorage.getItem(KEY_PENDING_ACTION);
    const pendingAction = pendingRaw
      ? (JSON.parse(pendingRaw) as PendingSignAction)
      : null;

    // Clean up
    sessionStorage.removeItem(KEY_PENDING_ACTION);

    return { signature, pendingAction };
  } catch {
    return null;
  }
}

// ─── Session helpers ─────────────────────────────────────────────────────────
export function getConnectedPublicKey(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("auron_connected_pubkey");
}

export function isPhantomSessionActive(): boolean {
  if (typeof window === "undefined") return false;
  return !!(
    sessionStorage.getItem(KEY_PHANTOM_PUBKEY) &&
    sessionStorage.getItem(KEY_PHANTOM_SESSION) &&
    sessionStorage.getItem("auron_connected_pubkey")
  );
}

export function clearPhantomSession(): void {
  sessionStorage.removeItem(KEY_DAPP_SECRET);
  sessionStorage.removeItem(KEY_PHANTOM_PUBKEY);
  sessionStorage.removeItem(KEY_PHANTOM_SESSION);
  sessionStorage.removeItem("auron_connected_pubkey");
  sessionStorage.removeItem(KEY_PENDING_ACTION);
}

// ─── Detect mobile / Phantom browser ─────────────────────────────────────────
export function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isPhantomBrowser(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as unknown as { phantom?: unknown }).phantom;
}
