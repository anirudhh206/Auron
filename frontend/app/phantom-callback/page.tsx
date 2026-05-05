"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { decryptPhantomResponse } from "@/lib/phantom-deeplink";
import { Suspense } from "react";

function PhantomCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("Connecting wallet...");

  useEffect(() => {
    const errorCode    = searchParams.get("errorCode");
    const errorMessage = searchParams.get("errorMessage");

    // User rejected the connection
    if (errorCode) {
      setStatus("error");
      setMessage(errorMessage ?? "Connection rejected.");
      setTimeout(() => router.replace("/app"), 2000);
      return;
    }

    const phantomEncryptionPublicKey = searchParams.get("phantom_encryption_public_key");
    const nonce = searchParams.get("nonce");
    const data  = searchParams.get("data");

    if (!phantomEncryptionPublicKey || !nonce || !data) {
      setStatus("error");
      setMessage("Invalid response from Phantom.");
      setTimeout(() => router.replace("/app"), 2000);
      return;
    }

    // Decrypt the response
    const result = decryptPhantomResponse(phantomEncryptionPublicKey, nonce, data);

    if (!result) {
      setStatus("error");
      setMessage("Failed to decrypt Phantom response.");
      setTimeout(() => router.replace("/app"), 2000);
      return;
    }

    // Store public key for the app to use
    sessionStorage.setItem("auron_connected_pubkey", result.publicKey);

    setStatus("success");
    setMessage(`Connected! Redirecting...`);

    // Redirect back to app
    setTimeout(() => router.replace("/app"), 1000);
  }, [searchParams, router]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#0A0A0F]">
      <div className="text-center px-6">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{
            background: status === "error"
              ? "rgba(239,68,68,0.15)"
              : status === "success"
              ? "rgba(16,185,129,0.15)"
              : "rgba(139,92,246,0.15)",
            border: `1px solid ${status === "error" ? "rgba(239,68,68,0.3)" : status === "success" ? "rgba(16,185,129,0.3)" : "rgba(139,92,246,0.3)"}`,
          }}>
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

        <p className="text-white font-semibold text-lg mb-1">
          {status === "processing" ? "Connecting Wallet" : status === "success" ? "Wallet Connected!" : "Connection Failed"}
        </p>
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>{message}</p>
      </div>
    </div>
  );
}

export default function PhantomCallbackPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 flex items-center justify-center bg-[#0A0A0F]">
        <div className="w-6 h-6 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <PhantomCallbackInner />
    </Suspense>
  );
}
