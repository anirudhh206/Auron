"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface AuditEntry {
  label: string;
  timestamp: string;
}

interface ReceiptScreenProps {
  merchant: string;
  upiId: string;
  inrAmount: number;
  usdcAmount: number;
  utr: string;
  receiptHash?: string;
  solscanUrl?: string;
  settledAt?: string;
  auditTrail?: AuditEntry[];
  onDone: () => void;
}

const C = {
  bg:     "#08080A",
  s1:     "#0F0F12",
  s2:     "#161619",
  border: "#26262A",
  borderB:"#3A3A3F",
  text:   "#F5F5F0",
  muted:  "#9A9AA8",
  dim:    "#606068",
  lime:   "#C8F135",
  gold:   "#F5A623",
  usdc:   "#2775CA",
};

const DEFAULT_AUDIT: AuditEntry[] = [
  { label: "Signature received",     timestamp: "T+0.8s" },
  { label: "On-chain verified (7/7)", timestamp: "T+2.1s" },
  { label: "Rate locked: ₹83.18",    timestamp: "T+2.4s" },
  { label: "Dispatched to OnMeta",   timestamp: "T+2.6s" },
  { label: "Bank verification",      timestamp: "T+9.2s" },
  { label: "Settlement complete",    timestamp: "T+14.2s" },
];

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@300;400;500;600&display=swap');

  .receipt-screen {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: ${C.bg};
    font-family: 'Geist', sans-serif;
    -webkit-font-smoothing: antialiased;
    position: relative;
    overflow: hidden;
  }

  .receipt-screen::after {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 320px;
    background: radial-gradient(ellipse 70% 55% at 50% 0%, rgba(200,241,53,0.07) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }

  .receipt-screen::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: radial-gradient(circle, ${C.border} 1px, transparent 1px);
    background-size: 28px 28px;
    opacity: 0.2;
    pointer-events: none;
    z-index: 0;
  }

  .receipt-content {
    position: relative;
    z-index: 1;
    flex: 1;
    overflow-y: auto;
    padding: 0 20px 24px;
    max-width: 390px;
    margin: 0 auto;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .receipt-header {
    padding: 14px 20px 0;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 1;
    flex-shrink: 0;
  }

  .success-mark {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 20px 0 4px;
  }
  .success-ring {
    width: 64px; height: 64px;
    border-radius: 50%;
    border: 1px solid rgba(200,241,53,0.3);
    background: rgba(200,241,53,0.07);
    display: flex; align-items: center; justify-content: center;
    position: relative;
  }
  .success-ring-pulse {
    position: absolute;
    inset: -4px;
    border-radius: 50%;
    border: 1px solid rgba(200,241,53,0.15);
    animation: ringPulse 2s ease-out infinite;
  }
  @keyframes ringPulse {
    0%   { transform: scale(1); opacity: 0.6; }
    100% { transform: scale(1.3); opacity: 0; }
  }

  .utr-block {
    background: ${C.s1};
    border: 1px solid ${C.border};
    border-radius: 12px;
    padding: 18px 16px;
    transition: border-color 0.2s;
  }
  .utr-block:hover { border-color: ${C.borderB}; }

  .utr-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .utr-number {
    font-family: 'Geist Mono', monospace;
    font-size: 19px;
    font-weight: 500;
    color: ${C.text};
    letter-spacing: -0.01em;
    word-break: break-all;
    line-height: 1.3;
  }

  .utr-divider {
    height: 0.5px;
    background: ${C.border};
    margin: 12px 0;
  }

  .proof-link {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 11px 14px;
    background: ${C.s2};
    border: 0.5px solid ${C.border};
    border-radius: 8px;
    text-decoration: none;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;
  }
  .proof-link:hover { border-color: ${C.borderB}; background: ${C.s1}; }

  .audit-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 12px 0;
    background: none;
    border: none;
    border-top: 0.5px solid ${C.border};
    cursor: pointer;
    transition: opacity 0.15s;
  }
  .audit-toggle:hover { opacity: 0.8; }

  .audit-entry {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 0.5px solid ${C.border};
  }
  .audit-entry:last-child { border-bottom: none; }
  .audit-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: ${C.lime};
    flex-shrink: 0;
    margin-top: 5px;
  }

  .done-btn {
    width: 100%;
    padding: 15px;
    border-radius: 12px;
    background: ${C.s2};
    border: 0.5px solid ${C.border};
    font-family: 'Geist', sans-serif;
    font-size: 14px;
    font-weight: 600;
    color: ${C.text};
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: border-color 0.15s, background 0.15s;
    flex-shrink: 0;
  }
  .done-btn:hover { border-color: ${C.borderB}; background: ${C.s1}; }
  .done-btn:active { transform: scale(0.99); }

  .copy-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    color: ${C.dim};
    transition: color 0.15s;
    display: flex;
    align-items: center;
  }
  .copy-btn:hover { color: ${C.muted}; }
`;

export default function ReceiptScreen({
  merchant, upiId, inrAmount, usdcAmount, utr,
  receiptHash, solscanUrl, settledAt, auditTrail, onDone,
}: ReceiptScreenProps) {
  const [auditOpen, setAuditOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const trail = auditTrail ?? DEFAULT_AUDIT;
  const displayTime = settledAt ?? new Date().toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
    timeZone: "Asia/Kolkata",
  }) + " IST";

  function copyUTR() {
    navigator.clipboard?.writeText(utr).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const fadeUp = (delay = 0) => ({
    initial: { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1], delay },
  });

  return (
    <>
      <style>{STYLES}</style>
      <div className="receipt-screen">
        <div className="receipt-header">
          <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.dim, letterSpacing: "0.1em" }}>
            RECEIPT
          </span>
        </div>

        <div className="receipt-content">
          <motion.div {...fadeUp(0)} className="success-mark">
            <div className="success-ring">
              <div className="success-ring-pulse" />
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 400, damping: 20 }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={C.lime} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </motion.div>
            </div>
            <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.lime, letterSpacing: "0.12em" }}>
              DELIVERED
            </p>
          </motion.div>

          <motion.div {...fadeUp(0.06)} style={{ textAlign: "center" }}>
            <p style={{ fontFamily: "'Instrument Serif',serif", fontSize: 22, color: C.text, margin: 0 }}>
              ₹{inrAmount.toLocaleString("en-IN")}{" "}
              <span style={{ color: C.muted, fontFamily: "'Geist',sans-serif", fontSize: 16, fontWeight: 400 }}>to</span>{" "}
              {merchant}
            </p>
            <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.dim, margin: "6px 0 0" }}>
              {displayTime}
            </p>
          </motion.div>

          <motion.div {...fadeUp(0.1)} className="utr-block">
            <div className="utr-header">
              <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, letterSpacing: "0.12em", margin: 0 }}>
                UTR NUMBER
              </p>
              <button className="copy-btn" onClick={copyUTR} title="Copy UTR">
                <AnimatePresence mode="wait">
                  {copied ? (
                    <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={C.lime} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </motion.div>
                  ) : (
                    <motion.div key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>
            </div>
            <p className="utr-number">{utr}</p>

            <div className="utr-divider" />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, letterSpacing: "0.1em", margin: 0 }}>
                UPI ID
              </p>
              <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.muted, margin: 0, overflow: "hidden", textOverflow: "ellipsis", maxWidth: "60%" }}>
                {upiId}
              </p>
            </div>

            <div className="utr-divider" />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, letterSpacing: "0.1em", margin: 0 }}>
                PAID
              </p>
              <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.usdc, margin: 0 }}>
                {usdcAmount.toFixed(2)} USDC
              </p>
            </div>

            <div className="utr-divider" />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, letterSpacing: "0.1em", margin: 0 }}>
                SETTLED AT
              </p>
              <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.muted, margin: 0 }}>
                {displayTime}
              </p>
            </div>
          </motion.div>

          <motion.div {...fadeUp(0.14)} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {solscanUrl && (
              <a className="proof-link" href={solscanUrl} target="_blank" rel="noopener noreferrer">
                <span style={{ fontSize: 13, color: C.muted }}>View on Solscan</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.dim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            )}
            {receiptHash && (
              <div className="proof-link" style={{ cursor: "default" }}>
                <span style={{ fontSize: 13, color: C.muted }}>Receipt hash</span>
                <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.dim }}>
                  {receiptHash}
                </span>
              </div>
            )}
          </motion.div>

          <motion.div {...fadeUp(0.18)}>
            <button className="audit-toggle" onClick={() => setAuditOpen(o => !o)}>
              <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, letterSpacing: "0.1em" }}>
                AUDIT TRAIL
              </span>
              <motion.div animate={{ rotate: auditOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.dim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </motion.div>
            </button>

            <AnimatePresence>
              {auditOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  style={{ overflow: "hidden" }}
                >
                  <div style={{ paddingBottom: 8 }}>
                    {trail.map((entry, i) => (
                      <motion.div
                        key={i}
                        className="audit-entry"
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                      >
                        <div className="audit-dot" />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>{entry.label}</p>
                        </div>
                        <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.lime, flexShrink: 0 }}>
                          {entry.timestamp}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          style={{ padding: "0 20px 28px", position: "relative", zIndex: 1, flexShrink: 0 }}
        >
          <button className="done-btn" onClick={onDone}>
            Done
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        </motion.div>
      </div>
    </>
  );
}
