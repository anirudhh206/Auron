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
  if (globalThis.window === undefined) return nacl.box.keyPair();

  const stored = localStorage.getItem(KEY_DAPP_SECRET);
  if (stored) {
    return nacl.box.keyPair.fromSecretKey(bs58.decode(stored));
  }

  const keypair = nacl.box.keyPair();
  localStorage.setItem(KEY_DAPP_SECRET, bs58.encode(keypair.secretKey));
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
    if (!decrypted) {
      console.error("[phantom-deeplink] nacl.box.open.after returned null — sharedSecret mismatch or corrupted data");
      return null;
    }

    // Phantom sends snake_case: { public_key, session }
    // Accept both snake_case (real Phantom) and camelCase (future-proofing)
    const publicKey = (decrypted.public_key ?? decrypted.publicKey) as string | undefined;
    const session   = decrypted.session as string | undefined;

    if (!publicKey || typeof publicKey !== "string") {
      console.error("[phantom-deeplink] Missing public_key in Phantom payload. Keys present:", Object.keys(decrypted));
      return null;
    }
    if (!session || typeof session !== "string") {
      console.error("[phantom-deeplink] Missing session in Phantom payload");
      return null;
    }

    localStorage.setItem(KEY_PHANTOM_PUBKEY, phantomEncryptionPublicKey);
    localStorage.setItem(KEY_PHANTOM_SESSION, session);
    localStorage.setItem("auron_connected_pubkey", publicKey);

    return { publicKey, session };
  } catch (err) {
    console.error("[phantom-deeplink] handleConnectResponse exception:", err);
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
    const phantomPubkey = localStorage.getItem(KEY_PHANTOM_PUBKEY);
    const session = localStorage.getItem(KEY_PHANTOM_SESSION);

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
    localStorage.setItem(KEY_PENDING_ACTION, JSON.stringify(pendingAction));

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
    const phantomPubkey = localStorage.getItem(KEY_PHANTOM_PUBKEY);
    if (!phantomPubkey) return null;

    const sharedSecret = getSharedSecret(phantomPubkey);
    const decrypted = decryptPayload(data, nonce, sharedSecret);
    if (!decrypted) return null;

    const signature = decrypted.signature as string;

    // Restore pending action
    const pendingRaw = localStorage.getItem(KEY_PENDING_ACTION);
    const pendingAction = pendingRaw
      ? (JSON.parse(pendingRaw) as PendingSignAction)
      : null;

    // Clean up
    localStorage.removeItem(KEY_PENDING_ACTION);

    return { signature, pendingAction };
  } catch {
    return null;
  }
}

// ─── Session helpers ─────────────────────────────────────────────────────────
export function getConnectedPublicKey(): string | null {
  if (globalThis.window === undefined) return null;
  const key = localStorage.getItem("auron_connected_pubkey");
  // Guard against localStorage storing the literal string "undefined" or "null"
  if (!key || key === "undefined" || key === "null") return null;
  return key;
}

export function isPhantomSessionActive(): boolean {
  if (globalThis.window === undefined) return false;
  const pubkey = getConnectedPublicKey();
  return !!(
    localStorage.getItem(KEY_PHANTOM_PUBKEY) &&
    localStorage.getItem(KEY_PHANTOM_SESSION) &&
    pubkey
  );
}

/**
 * Clears the Phantom *session* (wallet connection + pending actions).
 * Does NOT remove KEY_DAPP_SECRET — the dApp keypair must be stable across
 * connect/disconnect cycles. If we regenerated it on disconnect, the next
 * connect URL would use a new public key but any in-flight Phantom redirect
 * would still encrypt with the old one, causing decryption failure.
 */
export function clearPhantomSession(): void {
  // DO NOT remove KEY_DAPP_SECRET here — see comment above
  localStorage.removeItem(KEY_PHANTOM_PUBKEY);
  localStorage.removeItem(KEY_PHANTOM_SESSION);
  localStorage.removeItem("auron_connected_pubkey");
  localStorage.removeItem(KEY_PENDING_ACTION);
}

/**
 * Full reset — only call when user explicitly wants to wipe everything
 * (e.g. clearing app data, factory reset). This WILL break any pending
 * Phantom redirect that was already sent.
 */
export function clearAllPhantomData(): void {
  localStorage.removeItem(KEY_DAPP_SECRET);
  localStorage.removeItem(KEY_PHANTOM_PUBKEY);
  localStorage.removeItem(KEY_PHANTOM_SESSION);
  localStorage.removeItem("auron_connected_pubkey");
  localStorage.removeItem(KEY_PENDING_ACTION);
}

// ─── Detect mobile / Phantom browser ─────────────────────────────────────────
export function isMobile(): boolean {
  if (globalThis.window === undefined) return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isPhantomBrowser(): boolean {
  if (globalThis.window === undefined) return false;
  return !!(globalThis.window as unknown as { phantom?: unknown }).phantom;
}
