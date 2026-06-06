/**
 * Phantom Mobile Connect — deep link protocol (legacy wrapper)
 *
 * @deprecated — use lib/phantom-deeplink.ts directly.
 * This file re-exports from phantom-deeplink.ts so any code still importing
 * from here keeps working without a migration. Both files now share the same
 * localStorage keys and dApp keypair.
 *
 * Why sessionStorage was replaced with localStorage:
 *   On Android, when a deep link opens Phantom, the browser tab is
 *   backgrounded. When Phantom redirects back, Android may restart the tab,
 *   wiping sessionStorage entirely. localStorage survives tab restarts.
 *
 * Protocol reference: https://docs.phantom.app/phantom-deeplinks/provider-methods/connect
 */

export {
  buildPhantomConnectUrl,
  handleConnectResponse   as parsePhantomConnectResponse,
  getConnectedPublicKey   as getStoredWallet,
  clearPhantomSession     as clearStoredWallet,
  isPhantomSessionActive,
  type PhantomConnectResult,
} from "@/lib/phantom-deeplink";

// storeConnectedWallet is a no-op here — phantom-deeplink handles storage
// internally inside handleConnectResponse. Exported for call-site compat.
export function storeConnectedWallet(_publicKey: string): void {
  // handled inside handleConnectResponse — no manual call needed
}
