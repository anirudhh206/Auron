"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────
interface SettlementStep {
  id: string;
  label: string;
  sub: string;
  duration: number; // ms until this step completes
}

interface SettlementScreenProps {
  merchant: string;
  inrAmount: number;
  usdcAmount: number;
  txSignature?: string;
  onComplete: (utr: string) => void;
  isDemo?: boolean;
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

const STEPS: SettlementStep[] = [
  { id: "sig",    label: "Signature received",       sub: "Confirmed on device",              duration: 800 },
  { id: "verify", label: "On-chain verified (7/7)",  sub: "Solana devnet confirmation",       duration: 2100 },
  { id: "rate",   label: "Rate locked",              sub: "₹83.18 / USDC secured",            duration: 2400 },
  { id: "route",  label: "Dispatching to OnMeta",    sub: "Initiating fiat bridge transfer",  duration: 8000 },
  { id: "bank",   label: "Bank verification",        sub: "Awaiting UPI network ACK",         duration: 11000 },
  { id: "done",   label: "Settlement complete",      sub: "Funds available at merchant",      duration: 14200 },
];

function generateUTR() {
  const n = Math.floor(Math.random() * 1e12).toString().padStart(12, "0");
  return `YESB${n}`;
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@300;400;500;600&display=swap');

  .settlement-screen {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: ${C.bg};
    font-family: 'Geist', sans-serif;
    -webkit-font-smoothing: antialiased;
    position: relative;
    overflow: hidden;
  }

  /* Lime center glow — grows as settlement progresses */
  .settlement-glow {
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    border-radius: 50%;
    pointer-events: none;
    z-index: 0;
    transition: width 2s ease-out, height 2s ease-out, opacity 1s;
  }

  .settlement-content {
    position: relative;
    z-index: 1;
    flex: 1;
    overflow-y: auto;
    padding: 0 20px 32px;
    max-width: 390px;
    margin: 0 auto;
    width: 100%;
  }

  /* Header */
  .settle-header {
    padding: 14px 20px 0;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    z-index: 1;
    flex-shrink: 0;
  }

  /* Merchant amount block */
  .settle-merchant {
    text-align: center;
    padding: 24px 0 28px;
  }

  /* Timeline */
  .timeline {
    background: ${C.s1};
    border: 1px solid ${C.border};
    border-radius: 14px;
    padding: 20px 16px;
    position: relative;
    overflow: hidden;
  }

  .timeline-item {
    display: flex;
    gap: 14px;
    position: relative;
    padding-bottom: 22px;
  }
  .timeline-item:last-child { padding-bottom: 0; }

  .timeline-left {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    width: 12px;
  }

  .t-node {
    width: 12px; height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
    position: relative;
    z-index: 1;
  }
  .t-node-done {
    background: ${C.lime};
    box-shadow: 0 0 8px rgba(200,241,53,0.4);
  }
  .t-node-active {
    background: ${C.gold};
  }
  .t-node-pending {
    background: transparent;
    border: 1px solid ${C.border};
  }

  /* Pulse ring for active node */
  .t-pulse {
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    border: 1.5px solid ${C.gold};
    animation: pulseRing 1.4s ease-out infinite;
  }
  @keyframes pulseRing {
    0%   { opacity: 0.7; transform: scale(1); }
    100% { opacity: 0;   transform: scale(2); }
  }

  .t-line {
    flex: 1;
    width: 1px;
    margin-top: 4px;
  }
  .t-line-done { background: ${C.lime}; }
  .t-line-pending { background: ${C.border}; }

  .t-content {
    flex: 1;
    min-width: 0;
    padding-top: 0;
  }
  .t-label-done {
    font-size: 13px;
    font-weight: 500;
    color: ${C.lime};
  }
  .t-label-active {
    font-size: 13px;
    font-weight: 500;
    color: ${C.gold};
  }
  .t-label-pending {
    font-size: 13px;
    font-weight: 400;
    color: ${C.border};
  }
  .t-sub {
    font-family: 'Geist Mono', monospace;
    font-size: 10px;
    color: ${C.dim};
    margin-top: 2px;
  }
  .t-ts {
    font-family: 'Geist Mono', monospace;
    font-size: 10px;
    flex-shrink: 0;
    padding-top: 1px;
  }
  .t-ts-done { color: ${C.lime}; }
  .t-ts-active { color: ${C.gold}; }

  /* Bottom status */
  .settle-footer {
    padding: 16px 20px 24px;
    text-align: center;
    position: relative;
    z-index: 1;
    flex-shrink: 0;
  }
  .do-not-close {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border: 1px solid ${C.border};
    border-radius: 100px;
    font-family: 'Geist Mono', monospace;
    font-size: 10px;
    color: ${C.dim};
    letter-spacing: 0.08em;
    margin-bottom: 12px;
  }
  .do-not-close-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: ${C.gold};
    animation: pulseDot 1.5s ease-in-out infinite;
  }
  @keyframes pulseDot {
    0%,100% { opacity:1; }
    50% { opacity:0.3; }
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────
export default function SettlementScreen({
  merchant,
  inrAmount,
  usdcAmount,
  txSignature,
  onComplete,
  isDemo = false,
}: SettlementScreenProps) {
  const [completedCount, setCompletedCount] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [utr] = useState(generateUTR);

  // Tick elapsed time
  useEffect(() => {
    const t = setInterval(() => setElapsed((e: number) => e + 100), 100);
    return () => clearInterval(t);
  }, []);

  // Advance steps based on elapsed
  useEffect(() => {
    const count = STEPS.filter(s => elapsed >= s.duration).length;
    setCompletedCount(count);
    if (count === STEPS.length) {
      setTimeout(() => onComplete(utr), 400);
    }
  }, [elapsed, onComplete, utr]);

  const activeIdx = completedCount; // index of currently active step
  const glowSize = Math.min(completedCount * 60, 300);
  const glowOpacity = completedCount / STEPS.length * 0.06;

  return (
    <>
      <style>{STYLES}</style>
      <div className="settlement-screen">

        {/* Background lime glow */}
        <div
          className="settlement-glow"
          style={{
            width: glowSize,
            height: glowSize,
            background: `radial-gradient(circle, rgba(200,241,53,${glowOpacity * 10}) 0%, transparent 70%)`,
            opacity: glowOpacity > 0 ? 1 : 0,
          }}
        />

        {/* Dot grid */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
          backgroundImage: `radial-gradient(circle, ${C.border} 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
          opacity: 0.2,
        }} />

        {/* Header */}
        <div className="settle-header">
          <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.dim, letterSpacing: "0.1em" }}>
            SETTLING...
          </span>
        </div>

        <div className="settlement-content">

          {/* Merchant + amount */}
          <div className="settle-merchant">
            <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, letterSpacing: "0.1em", marginBottom: 8 }}>
              PAYMENT TO
            </p>
            <p style={{ fontFamily: "'Instrument Serif',serif", fontSize: 26, color: C.text, margin: "0 0 10px" }}>
              {merchant}
            </p>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 10 }}>
              <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 28, fontWeight: 500, color: C.gold, letterSpacing: "-0.02em" }}>
                ₹{inrAmount.toLocaleString("en-IN")}
              </span>
              <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 13, color: C.dim }}>
                {usdcAmount} USDC
              </span>
            </div>
          </div>

          {/* Timeline */}
          <div className="timeline">
            {STEPS.map((step, i) => {
              const isDone   = i < completedCount;
              const isActive = i === activeIdx && i < STEPS.length;
              const isPending = !isDone && !isActive;
              const ts = isDone
                ? `T+${(step.duration / 1000).toFixed(1)}s`
                : isActive
                ? `T+${(elapsed / 1000).toFixed(1)}s`
                : "";

              return (
                <motion.div
                  key={step.id}
                  className="timeline-item"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: isPending ? 0.35 : 1, x: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.35 }}
                >
                  {/* Left: node + line */}
                  <div className="timeline-left">
                    <div className={`t-node ${isDone ? "t-node-done" : isActive ? "t-node-active" : "t-node-pending"}`}>
                      {isActive && <div className="t-pulse" />}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`t-line ${isDone ? "t-line-done" : "t-line-pending"}`} />
                    )}
                  </div>

                  {/* Right: content */}
                  <div style={{ display: "flex", flex: 1, justifyContent: "space-between", gap: 8 }}>
                    <div className="t-content">
                      <AnimatePresence mode="wait">
                        {isDone && (
                          <motion.p key="done" className="t-label-done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            {step.label}
                          </motion.p>
                        )}
                        {isActive && (
                          <motion.p key="active" className="t-label-active" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            {step.label}
                          </motion.p>
                        )}
                        {isPending && (
                          <p className="t-label-pending">{step.label}</p>
                        )}
                      </AnimatePresence>
                      <p className="t-sub">{step.sub}</p>
                    </div>
                    {ts && (
                      <span className={`t-ts ${isDone ? "t-ts-done" : "t-ts-active"}`}>
                        {ts}
                      </span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="settle-footer">
          <div>
            <div className="do-not-close">
              <span className="do-not-close-dot" />
              DO NOT CLOSE THIS SCREEN
            </div>
          </div>
          {txSignature && (
            <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, letterSpacing: "0.04em" }}>
              TX: {txSignature.slice(0, 8)}...{txSignature.slice(-6)}
            </p>
          )}
        </div>

      </div>
    </>
  );
}
