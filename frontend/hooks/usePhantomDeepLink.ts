"use client";

/**
 * usePhantomDeepLink
 *
 * Manages Phantom Mobile Deep Link sessions.
 * Works in Chrome / any Android browser — no Phantom browser required.
 *
 * Flow:
 *  1. connect()          — opens Phantom app via deep link, redirects back to /phantom-callback?action=connect
 *  2. signAndSend()      — opens Phantom app to sign a tx, redirects back to /phantom-callback?action=sign
 *  3. consumeCompletedSignature() — reads signature from sessionStorage on return, clears it
 *  4. consumePhantomError()       — reads rejection/error from sessionStorage on return, clears it
 */

import { useState, useEffect, useCallback } from "react";
import type { Transaction, VersionedTransaction } from "@solana/web3.js";
import {
  buildPhantomConnectUrl,
  buildSignAndSendTransactionUrl,
  isPhantomSessionActive,
  getConnectedPublicKey,
  clearPhantomSession,
  isMobile,
  isPhantomBrowser,
  type PendingSignAction,
} from "@/lib/phantom-deeplink";

// ── sessionStorage keys ───────────────────────────────────────────────────────
export const KEY_MOBILE_PAYMENT_CONTEXT = "auron_mobile_payment_context";
export const KEY_COMPLETED_SIGNATURE    = "auron_completed_signature";
export const KEY_PHANTOM_ERROR          = "auron_phantom_error";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Full payment context serialised to sessionStorage before the Phantom redirect. */
export interface MobilePaymentContext {
  paymentId:      string;
  idempotencyKey: string;
  usdcAmount:     number;
  inrAmount:      number;
  upiId:          string;
  merchantName:   string;
  fromAddress:    string;
  toAddress:      string;
  fxRate:         number;
  confirmText:    string;
  actionType:     string;   // "upi_payment" | "transfer_usdc" | …
}

export interface CompletedSignature {
  signature:     string;
  pendingAction: PendingSignAction | null;
  timestamp:     number;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePhantomDeepLink() {
  const [isConnected, setIsConnected] = useState(false);
  const [publicKey,   setPublicKey]   = useState<string | null>(null);

  // Only computed once — they don't change mid-session
  const [isMobileDevice]     = useState(() => typeof window !== "undefined" ? isMobile()        : false);
  const [isInPhantomBrowser] = useState(() => typeof window !== "undefined" ? isPhantomBrowser(): false);

  // ── Sync session state from sessionStorage ────────────────────────────────
  useEffect(() => {
    const active = isPhantomSessionActive();
    setIsConnected(active);
    setPublicKey(getConnectedPublicKey());
  }, []);

  // ── Connect ───────────────────────────────────────────────────────────────
  /** Redirects to Phantom to initiate a wallet connection. */
  const connect = useCallback(() => {
    if (typeof window === "undefined") return;
    const cluster =
      process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta"
        ? ("mainnet-beta" as const)
        : ("devnet" as const);
    const url = buildPhantomConnectUrl(window.location.origin, cluster);
    window.location.href = url;
  }, []);

  // ── Disconnect ────────────────────────────────────────────────────────────
  const disconnect = useCallback(() => {
    clearPhantomSession();
    setIsConnected(false);
    setPublicKey(null);
  }, []);

  // ── Sign & Send ───────────────────────────────────────────────────────────
  /**
   * Serialise `paymentContext` to sessionStorage, then redirect to Phantom
   * to sign and send `transaction`.  Returns false if the session is gone.
   *
   * IMPORTANT: this call redirects away from the current page.
   */
  const signAndSend = useCallback(
    (
      transaction:    Transaction | VersionedTransaction,
      pendingAction:  PendingSignAction,
      paymentContext?: MobilePaymentContext,
    ): boolean => {
      if (typeof window === "undefined") return false;

      // Persist payment context so we can resume after redirect
      if (paymentContext) {
        sessionStorage.setItem(KEY_MOBILE_PAYMENT_CONTEXT, JSON.stringify(paymentContext));
      }

      const url = buildSignAndSendTransactionUrl(
        transaction,
        window.location.origin,
        pendingAction,
      );
      if (!url) return false;

      window.location.href = url;
      return true;
    },
    [],
  );

  // ── Consume completed signature ───────────────────────────────────────────
  /**
   * Call once on app mount.  If Phantom just returned a signature, returns it
   * together with the stored payment context.  Clears sessionStorage.
   */
  const consumeCompletedSignature = useCallback((): {
    completed:      CompletedSignature;
    paymentContext: MobilePaymentContext | null;
  } | null => {
    if (typeof window === "undefined") return null;

    const sigRaw = sessionStorage.getItem(KEY_COMPLETED_SIGNATURE);
    if (!sigRaw) return null;

    try {
      const completed = JSON.parse(sigRaw) as CompletedSignature;

      const ctxRaw       = sessionStorage.getItem(KEY_MOBILE_PAYMENT_CONTEXT);
      const paymentContext = ctxRaw ? (JSON.parse(ctxRaw) as MobilePaymentContext) : null;

      sessionStorage.removeItem(KEY_COMPLETED_SIGNATURE);
      sessionStorage.removeItem(KEY_MOBILE_PAYMENT_CONTEXT);

      return { completed, paymentContext };
    } catch {
      sessionStorage.removeItem(KEY_COMPLETED_SIGNATURE);
      sessionStorage.removeItem(KEY_MOBILE_PAYMENT_CONTEXT);
      return null;
    }
  }, []);

  // ── Consume Phantom error ─────────────────────────────────────────────────
  /**
   * If Phantom returned an error (user rejected, etc.) returns it and clears.
   */
  const consumePhantomError = useCallback((): {
    errorCode:    string;
    errorMessage: string;
    action:       string;
  } | null => {
    if (typeof window === "undefined") return null;
    const raw = sessionStorage.getItem(KEY_PHANTOM_ERROR);
    if (!raw) return null;
    sessionStorage.removeItem(KEY_PHANTOM_ERROR);
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }, []);

  // ── Refresh connection state (call after redirect-back) ───────────────────
  const refreshSession = useCallback(() => {
    const active = isPhantomSessionActive();
    setIsConnected(active);
    setPublicKey(getConnectedPublicKey());
  }, []);

  return {
    /** True when a Phantom deep-link session is active in sessionStorage. */
    isConnected,
    /** Connected wallet public key (base58), or null. */
    publicKey,
    /** Open Phantom app to connect wallet (redirects away). */
    connect,
    /** Clear the deep-link session. */
    disconnect,
    /** Build sign URL + redirect to Phantom (redirects away). */
    signAndSend,
    /** Read & clear signature after returning from Phantom. */
    consumeCompletedSignature,
    /** Read & clear error after Phantom rejection. */
    consumePhantomError,
    /** Re-sync session state from sessionStorage. */
    refreshSession,
    /** True on Android / iPhone (not inside Phantom's built-in browser). */
    isMobileDevice,
    /** True when running inside Phantom's built-in browser. */
    isInPhantomBrowser,
  };
}
