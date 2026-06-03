"use client";

// Global error boundary — catches errors in the root layout itself
// Renders without the root layout, so must include <html> and <body>

import { useEffect } from "react";

interface GlobalErrorProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("[Auron Global Error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ background: "#030712", margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          color: "white",
          textAlign: "center",
        }}>
          <div style={{ maxWidth: "360px" }}>
            <div style={{
              width: 64, height: 64,
              borderRadius: 16,
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px",
              fontSize: 28,
            }}>
              ⚠️
            </div>
            <h1 style={{ fontWeight: 700, fontSize: 20, marginBottom: 8 }}>
              Auron is temporarily unavailable
            </h1>
            <p style={{ color: "#9ca3af", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              A critical error occurred. Your wallet and funds are safe — no
              transactions were submitted without your confirmation.
            </p>
            {error.digest && (
              <p style={{ color: "#4b5563", fontSize: 11, fontFamily: "monospace", marginBottom: 20 }}>
                ID: {error.digest}
              </p>
            )}
            <button
              type="button"
              onClick={reset}
              style={{
                background: "#7c3aed",
                color: "white",
                border: "none",
                borderRadius: 12,
                padding: "12px 24px",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
                width: "100%",
              }}
            >
              Reload Auron
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
