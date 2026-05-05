/**
 * Phantom Mobile Deep Link Protocol
 * Connects Phantom wallet from a PWA/website on Android
 * https://docs.phantom.app/phantom-deeplinks/provider-methods/connect
 */

import nacl from "tweetnacl";
import bs58 from "bs58";

const PHANTOM_DEEPLINK_BASE = "https://phantom.app/ul/v1";

// ─── Session storage keys ─────────────────────────────────────────────────────
const SESSION_KEY_DAPP_SECRET = "auron_dapp_secret";
const SESSION_KEY_PHANTOM_KEY = "auron_phantom_pubkey";
const SESSION_KEY_SESSION     = "auron_phantom_session";

// ─── Generate or retrieve dApp keypair ───────────────────────────────────────
export function getDappKeypair(): nacl.BoxKeyPair {
  if (typeof window === "undefined") return nacl.box.keyPair();

  const stored = sessionStorage.getItem(SESSION_KEY_DAPP_SECRET);
  if (stored) {
    const secretKey = bs58.decode(stored);
    return nacl.box.keyPair.fromSecretKey(secretKey);
  }

  const keypair = nacl.box.keyPair();
  sessionStorage.setItem(SESSION_KEY_DAPP_SECRET, bs58.encode(keypair.secretKey));
  return keypair;
}

// ─── Build connect URL ────────────────────────────────────────────────────────
export function buildPhantomConnectUrl(appUrl: string, cluster: "devnet" | "mainnet-beta" = "devnet"): string {
  const dappKeypair = getDappKeypair();
  const dappPublicKey = bs58.encode(dappKeypair.publicKey);

  // After approving, Phantom redirects back here
  const redirectLink = `${appUrl}/phantom-callback`;

  const params = new URLSearchParams({
    dapp_encryption_public_key: dappPublicKey,
    cluster,
    app_url: appUrl,
    redirect_link: redirectLink,
  });

  return `${PHANTOM_DEEPLINK_BASE}/connect?${params.toString()}`;
}

// ─── Decrypt Phantom connect response ────────────────────────────────────────
export interface PhantomConnectResult {
  publicKey: string;
  session: string;
}

export function decryptPhantomResponse(
  phantomEncryptionPublicKey: string,
  nonce: string,
  data: string
): PhantomConnectResult | null {
  try {
    const dappKeypair = getDappKeypair();
    const phantomPubKey = bs58.decode(phantomEncryptionPublicKey);
    const nonceBytes = bs58.decode(nonce);
    const dataBytes = bs58.decode(data);

    const decrypted = nacl.box.open(
      dataBytes,
      nonceBytes,
      phantomPubKey,
      dappKeypair.secretKey
    );

    if (!decrypted) return null;

    const result = JSON.parse(new TextDecoder().decode(decrypted)) as PhantomConnectResult;

    // Store for signing transactions later
    sessionStorage.setItem(SESSION_KEY_PHANTOM_KEY, phantomEncryptionPublicKey);
    sessionStorage.setItem(SESSION_KEY_SESSION, result.session);

    return result;
  } catch {
    return null;
  }
}

// ─── Detect mobile ────────────────────────────────────────────────────────────
export function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// ─── Check if running inside Phantom browser ──────────────────────────────────
export function isPhantomBrowser(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as unknown as { phantom?: unknown }).phantom;
}
