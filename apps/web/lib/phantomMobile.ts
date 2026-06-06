/**
 * Phantom Mobile Connect — deep link protocol (legacy wrapper)
 *
 * @deprecated — use lib/phantom-deeplink.ts directly.
 * This file exists so legacy call-sites (WalletWidget, ConnectWalletButton)
 * keep working without migration. Both files share the same localStorage keys
 * and dApp keypair via phantom-deeplink.ts.
 *
 * Why sessionStorage was replaced with localStorage:
 *   On Android, when a deep link opens Phantom, the browser tab is
 *   backgrounded. When Phantom redirects back, Android may restart the tab,
 *   wiping sessionStorage entirely. localStorage survives tab restarts.
 *
 * Protocol reference: https://docs.phantom.app/phantom-deeplinks/provider-methods/connect
 */

import {
  buildPhantomConnectUrl as _buildPhantomConnectUrl,
  handleConnectResponse,
} from "@/lib/phantom-deeplink";

export {
  getConnectedPublicKey as getStoredWallet,
  clearPhantomSession   as clearStoredWallet,
  isPhantomSessionActive,
  type PhantomConnectResult,
} from "@/lib/phantom-deeplink";

/**
 * Zero-arg wrapper — matches the old phantomMobile.ts call signature.
 * WalletWidget calls buildPhantomConnectUrl() with no args; this fills in
 * appUrl (window.location.origin) and cluster (from env) automatically.
 */
export function buildPhantomConnectUrl(): string {
  const appUrl  = typeof window !== "undefined" ? window.location.origin : "";
  const cluster = process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta"
    ? ("mainnet-beta" as const)
    : ("devnet" as const);
  return _buildPhantomConnectUrl(appUrl, cluster);
}

/**
 * Legacy 1-arg adapter — unpacks URLSearchParams and delegates to
 * handleConnectResponse(phantomEncryptionPublicKey, nonce, data).
 *
 * WalletWidget calls: parsePhantomConnectResponse(new URLSearchParams(...))
 * Old phantomMobile.ts accepted that signature; this preserves compat.
 */
export function parsePhantomConnectResponse(
  params: URLSearchParams
) {
  const phantomEncryptionPublicKey = params.get("phantom_encryption_public_key");
  const nonce = params.get("nonce");
  const data  = params.get("data");

  if (!phantomEncryptionPublicKey || !nonce || !data) return null;

  // User rejected
  if (params.get("errorCode")) {
    console.error("[phantomMobile] Phantom rejected:", params.get("errorMessage"));
    return null;
  }

  return handleConnectResponse(phantomEncryptionPublicKey, nonce, data);
}

// storeConnectedWallet is a no-op — handleConnectResponse stores internally
export function storeConnectedWallet(_publicKey: string): void {
  // Handled inside handleConnectResponse — no manual call needed
}
