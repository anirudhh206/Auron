"use client";

import { useState, useEffect, ReactNode } from "react";

export function WalletProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setMounted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load wallet");
    }
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#030712] text-white">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-bold mb-2">Connection Error</h1>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-violet-600 rounded-lg hover:bg-violet-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!mounted) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#030712]">
        <div className="text-center">
          <div className="inline-block">
            <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center mb-4">
              <svg
                className="w-4 h-4 text-white animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
            <p className="text-gray-400">Initializing Auron...</p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
