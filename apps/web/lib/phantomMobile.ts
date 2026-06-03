/**
 * Phantom Mobile Connect — proper deep link protocol implementation
 *
 * Why this exists:
 *   @solana/wallet-adapter-phantom handles browser extensions only.
 *   On mobile (PWA / Chrome / Safari), Phantom uses an encrypted deep link
 *   protocol. The adapter generates an ephemeral X25519 keypair, sends the
 *   public key to Phantom, Phantom encrypts the response, and redirects back.
 *   The problem: the private key lives in memory. When Phantom redirects back,
 *   the page RELOADS — memory is gone — decryption fails.
 *
 * The fix:
 *   Store the private key in sessionStorage before redirecting to Phantom.
 *   On page load, check for Phantom's response params, retrieve the key,
 *   and decrypt.
 *
 * Protocol reference: https://docs.phantom.app/phantom-deeplinks/provider-methods/connect
 */

import nacl from "tweetnacl";
import bs58 from "bs58";

const SESSION_KEY = "phantom_dapp_secret_key";
const CLUSTER = process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta"
  ? "mainnet-beta"
  : "devnet";

// ─── Build connect deep link ───────────────────────────────────────────────────

export function buildPhantomConnectUrl(): string {
  // Generate ephemeral X25519 keypair for this session
  const kp = nacl.box.keyPair();

  // Persist private key — survives page reload within the same browser tab
  sessionStorage.setItem(SESSION_KEY, bs58.encode(kp.secretKey));

  const appUrl = encodeURIComponent("https://auron-mocha.vercel.app");
  const pubKey = bs58.encode(kp.publicKey);

  // Phantom redirects back here after connect
  const redirectLink = encodeURIComponent(window.location.href.split("?")[0]);

  return (
    `https://phantom.app/ul/v1/connect` +
    `?app_url=${appUrl}` +
    `&dapp_encryption_public_key=${pubKey}` +
    `&redirect_link=${redirectLink}` +
    `&cluster=${CLUSTER}`
  );
}

// ─── Parse & decrypt Phantom's response ───────────────────────────────────────

export interface PhantomConnectResult {
  publicKey: string;   // Solana wallet base58 public key
  session: string;     // Phantom session token (needed for future sign requests)
}

export function parsePhantomConnectResponse(
  searchParams: URLSearchParams
): PhantomConnectResult | null {
  const phantomPubKey = searchParams.get("phantom_encryption_public_key");
  const nonce = searchParams.get("nonce");
  const data = searchParams.get("data");

  // Not a Phantom response
  if (!phantomPubKey || !nonce || !data) return null;

  // User rejected
  const errorCode = searchParams.get("errorCode");
  if (errorCode) {
    console.error("Phantom connect rejected:", searchParams.get("errorMessage"));
    return null;
  }

  // Retrieve stored private key
  const storedSecret = sessionStorage.getItem(SESSION_KEY);
  if (!storedSecret) {
    console.error("Phantom: no stored dApp secret key — keypair lost");
    return null;
  }

  try {
    const dappSecretKey = bs58.decode(storedSecret);
    const phantomPubKeyBytes = bs58.decode(phantomPubKey);
    const nonceBytes = bs58.decode(nonce);
    const dataBytes = bs58.decode(data);

    // Shared secret via Diffie-Hellman, then decrypt with NaCl box
    const sharedSecret = nacl.box.before(phantomPubKeyBytes, dappSecretKey);
    const decrypted = nacl.box.open.after(dataBytes, nonceBytes, sharedSecret);

    if (!decrypted) {
      console.error("Phantom: decryption failed");
      return null;
    }

    const payload = JSON.parse(new TextDecoder().decode(decrypted)) as {
      public_key: string;
      session: string;
    };

    // Clean up — don't leave private key in storage longer than needed
    sessionStorage.removeItem(SESSION_KEY);

    return { publicKey: payload.public_key, session: payload.session };
  } catch (err) {
    console.error("Phantom: parse error", err);
    return null;
  }
}

// ─── Store resolved wallet for cross-session use (PWA ↔ Phantom browser) ─────

const WALLET_KEY = "phantom_connected_wallet";

export function storeConnectedWallet(publicKey: string) {
  localStorage.setItem(WALLET_KEY, publicKey);
}

export function getStoredWallet(): string | null {
  return localStorage.getItem(WALLET_KEY);
}

export function clearStoredWallet() {
  localStorage.removeItem(WALLET_KEY);
  sessionStorage.removeItem(SESSION_KEY);
}
