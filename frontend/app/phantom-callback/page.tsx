"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { handleConnectResponse, handleSignResponse } from "@/lib/phantom-deeplink";

function PhantomCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("Processing…");

  const action = searchParams.get("action") ?? "connect";

  useEffect(() => {
    const errorCode    = searchParams.get("errorCode");
    const errorMessage = searchParams.get("errorMessage");

    // ── Phantom returned an error (user rejected, etc.) ───────────────────
    if (errorCode) {
      setStatus("error");
      setMessage(errorMessage ?? "Rejected by user.");
      // Persist error so ChatInterface can surface it after redirect
      localStorage.setItem(
        "auron_phantom_error",
        JSON.stringify({ errorCode, errorMessage, action })
      );
      setTimeout(() => router.replace("/app"), 2000);
      return;
    }

    // ── CONNECT response ──────────────────────────────────────────────────
    if (action === "connect") {
      const phantomEncryptionPublicKey = searchParams.get("phantom_encryption_public_key");
      const nonce = searchParams.get("nonce");
      const data  = searchParams.get("data");

      if (!phantomEncryptionPublicKey || !nonce || !data) {
        setStatus("error");
        setMessage("Invalid connect response from Phantom.");
        setTimeout(() => router.replace("/app"), 2000);
        return;
      }

      const result = handleConnectResponse(phantomEncryptionPublicKey, nonce, data);
      if (!result) {
        setStatus("error");
        setMessage("Could not decrypt Phantom response. Please try again.");
        setTimeout(() => router.replace("/app"), 2000);
        return;
      }

      setStatus("success");
      setMessage("Wallet connected! Returning to Auron…");
      setTimeout(() => router.replace("/app"), 800);
      return;
    }

    // ── SIGN response ─────────────────────────────────────────────────────
    if (action === "sign") {
      const nonce = searchParams.get("nonce");
      const data  = searchParams.get("data");

      if (!nonce || !data) {
        setStatus("error");
        setMessage("Invalid sign response from Phantom.");
        setTimeout(() => router.replace("/app"), 2000);
        return;
      }

      const result = handleSignResponse(data, nonce);
      if (!result) {
        setStatus("error");
        setMessage("Could not decrypt signature. Please try again.");
        setTimeout(() => router.replace("/app"), 2000);
        return;
      }

      // Store completed signature for ChatInterface to pick up on mount
      localStorage.setItem(
        "auron_completed_signature",
        JSON.stringify({
          signature:     result.signature,
          pendingAction: result.pendingAction,
          timestamp:     Date.now(),
        })
      );

      setStatus("success");
      setMessage("Transaction signed! Returning to Auron…");

      const returnPath = result.pendingAction?.returnPath ?? "/app";
      setTimeout(() => router.replace(returnPath), 600);
      return;
    }

    // Unknown action
    setStatus("error");
    setMessage("Unknown callback action.");
    setTimeout(() => router.replace("/app"), 2000);
  }, [searchParams, router, action]);

  const isSign = action === "sign";

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#0A0A0F]">
      <div className="text-center px-6">

        {/* Status icon */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{
            background:
              status === "error"   ? "rgba(239,68,68,0.15)"  :
              status === "success" ? "rgba(16,185,129,0.15)" :
                                     "rgba(139,92,246,0.15)",
            border: `1px solid ${
              status === "error"   ? "rgba(239,68,68,0.3)"  :
              status === "success" ? "rgba(16,185,129,0.3)" :
                                     "rgba(139,92,246,0.3)"
            }`,
          }}
        >
          {status === "processing" && (
            <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
          )}
          {status === "success" && (
            <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {status === "error" && (
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>

        {/* Heading */}
        <p className="text-white font-semibold text-lg mb-1">
          {status === "processing"
            ? isSign ? "Processing Signature" : "Connecting Wallet"
            : status === "success"
            ? isSign ? "Transaction Signed!" : "Wallet Connected!"
            : isSign ? "Signing Failed"      : "Connection Failed"}
        </p>

        {/* Sub-message */}
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
          {message}
        </p>

        {/* Phantom branding hint */}
        {status === "processing" && (
          <p className="text-xs mt-4" style={{ color: "rgba(255,255,255,0.2)" }}>
            Powered by Phantom Deep Link Protocol
          </p>
        )}
      </div>
    </div>
  );
}

export default function PhantomCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 flex items-center justify-center bg-[#0A0A0F]">
          <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <PhantomCallbackInner />
    </Suspense>
  );
}
