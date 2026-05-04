"use client";

// App Router error boundary — catches errors in all routes under app/
// Next.js automatically renders this when an unhandled error occurs

import { useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorPageProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log to error monitoring (Sentry in production)
    console.error("[Auron Error Boundary]", error);
  }, [error]);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--bg-base, #030712)" }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm text-center space-y-6"
      >
        {/* Icon */}
        <div className="flex justify-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}
          >
            <AlertTriangle size={28} className="text-red-400" />
          </div>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h1 className="text-white font-bold text-xl">Something went wrong</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            {error.message?.length < 120
              ? error.message
              : "An unexpected error occurred. Your funds are safe — no transaction was submitted."}
          </p>
          {error.digest && (
            <p className="text-gray-600 text-xs font-mono mt-1">
              Error ID: {error.digest}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={reset}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-all duration-150 active:scale-95"
            style={{ background: "rgba(124,58,237,0.9)", color: "white" }}
          >
            <RefreshCw size={15} />
            Try again
          </button>
          <button
            type="button"
            onClick={() => { globalThis.location.href = "/app"; }}
            className="w-full py-3 rounded-xl text-sm font-medium transition-all duration-150"
            style={{ background: "rgba(255,255,255,0.04)", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            Go back to Auron
          </button>
        </div>

        <p className="text-gray-700 text-xs">
          Your wallet and funds are unaffected.
        </p>
      </motion.div>
    </div>
  );
}
