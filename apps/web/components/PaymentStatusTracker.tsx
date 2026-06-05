"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, RefreshCw, Clock, AlertTriangle, RotateCcw, ExternalLink } from "lucide-react";
import AuronLogo from "@/components/AuronLogo";
import { PaymentRecord, PaymentStatus, getStepIndex, quoteSecondsRemaining } from "@/lib/payment-state";
import { getTxExplorerUrl } from "@/lib/solana";

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
  error:  "#EF4444",
};

interface PaymentStatusTrackerProps {
  payment: PaymentRecord;
  onRetry?: () => void;
  onRequestRefund?: () => void;
  onDismiss?: () => void;
  onViewReceipt?: () => void;
}

const STEPS: { status: PaymentStatus; label: string; desc: string }[] = [
  { status: "awaiting_signature", label: "Quote Generated",     desc: "Rate locked, ready to sign" },
  { status: "tx_pending",         label: "Wallet Signed",       desc: "Transaction broadcasting" },
  { status: "tx_confirmed",       label: "USDC Received",       desc: "On-chain confirmed" },
  { status: "offramp_initiated",  label: "Settlement Verified", desc: "Off-ramp initiated" },
  { status: "completed",          label: "UPI Delivered",       desc: "Merchant paid" },
];

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');

  .pst-root {
    width: 100%;
    max-width: 390px;
    margin: 0 auto;
    border-radius: 20px;
    overflow: hidden;
    background: ${C.s1};
    font-family: 'Geist', sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .pst-header {
    padding: 16px 20px;
    border-bottom: 0.5px solid ${C.border};
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .pst-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .pst-step {
    display: flex;
    gap: 14px;
    position: relative;
  }
  .pst-step-left {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex-shrink: 0;
    width: 32px;
  }
  .pst-node {
    width: 32px; height: 32px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    transition: background 0.3s, border-color 0.3s;
  }
  .pst-node-done {
    background: rgba(200,241,53,0.1);
    border: 1.5px solid rgba(200,241,53,0.4);
  }
  .pst-node-active {
    background: rgba(245,166,35,0.1);
    border: 1.5px solid rgba(245,166,35,0.4);
  }
  .pst-node-pending {
    background: rgba(38,38,42,0.5);
    border: 1.5px solid ${C.border};
  }
  .pst-connector {
    flex: 1;
    width: 1px;
    margin-top: 4px;
    transition: background 0.4s;
  }
  .pst-step-content {
    flex: 1;
    padding: 6px 0 20px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
  }

  .pst-summary {
    padding: 14px 16px;
    border-radius: 12px;
    text-align: center;
  }

  .pst-error {
    padding: 12px 14px;
    border-radius: 10px;
    background: rgba(239,68,68,0.06);
    border: 1px solid rgba(239,68,68,0.2);
    display: flex;
    gap: 10px;
  }

  .pst-tx-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-radius: 10px;
    background: ${C.s2};
    border: 1px solid ${C.border};
  }

  .pst-btn-primary {
    flex: 1;
    padding: 13px;
    border-radius: 12px;
    background: ${C.lime};
    border: none;
    font-family: 'Geist', sans-serif;
    font-size: 14px;
    font-weight: 700;
    color: #0A0A08;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: background 0.15s;
  }
  .pst-btn-primary:hover { background: #A3C42A; }

  .pst-btn-secondary {
    flex: 1;
    padding: 11px;
    border-radius: 12px;
    background: ${C.s2};
    border: 1px solid ${C.border};
    font-family: 'Geist', sans-serif;
    font-size: 13px;
    font-weight: 500;
    color: ${C.muted};
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: border-color 0.15s, color 0.15s;
  }
  .pst-btn-secondary:hover { border-color: ${C.borderB}; color: ${C.text}; }

  .pst-btn-ghost {
    padding: 10px 20px;
    border-radius: 12px;
    background: transparent;
    border: 1px solid ${C.border};
    font-family: 'Geist', sans-serif;
    font-size: 13px;
    color: ${C.dim};
    cursor: pointer;
    transition: border-color 0.15s;
  }
  .pst-btn-ghost:hover { border-color: ${C.borderB}; }
`;

export default function PaymentStatusTracker({
  payment, onRetry, onRequestRefund, onDismiss, onViewReceipt,
}: PaymentStatusTrackerProps) {
  const [secondsLeft, setSecondsLeft] = useState(quoteSecondsRemaining(payment));
  const [stepTimes] = useState<number[]>(() => [2.4, 1.8, 3.2, 2.1, 3.2]);

  useEffect(() => {
    if (payment.status !== "idle" && payment.status !== "awaiting_signature") return;
    const iv = setInterval(() => setSecondsLeft(quoteSecondsRemaining(payment)), 1000);
    return () => clearInterval(iv);
  }, [payment]);

  const isCompleted = payment.status === "completed";
  const isFailed    = payment.status === "failed";
  const isRefunded  = payment.status === "refunded";
  const isRefunding = payment.status === "refund_pending";
  const isTerminal  = isCompleted || isFailed || isRefunded;

  const activeStepIdx = getStepIndex(payment.status);
  const elapsedMs = payment.completedAt
    ? payment.completedAt - payment.initiatedAt
    : Date.now() - payment.initiatedAt;
  const totalSecs = isCompleted ? (elapsedMs / 1000).toFixed(1) : null;

  const borderColor = isCompleted
    ? "rgba(200,241,53,0.25)"
    : isFailed
    ? "rgba(239,68,68,0.25)"
    : C.border;

  return (
    <>
      <style>{STYLES}</style>
      <motion.div
        className="pst-root"
        style={{ border: `1px solid ${borderColor}` }}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 380, damping: 36 }}
      >
        <div className="pst-header">
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
            {isCompleted ? "Payment Complete" : isFailed ? "Payment Failed" : "Settling…"}
          </span>
          {!isTerminal && secondsLeft > 0 && secondsLeft < 60 && (
            <div style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "4px 10px", borderRadius: 20,
              background: secondsLeft < 15 ? "rgba(239,68,68,0.08)" : C.s2,
              border: `1px solid ${secondsLeft < 15 ? "rgba(239,68,68,0.25)" : C.border}`,
            }}>
              <Clock size={10} color={secondsLeft < 15 ? C.error : C.dim} />
              <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, fontWeight: 700, color: secondsLeft < 15 ? C.error : C.dim }}>
                {secondsLeft}s
              </span>
            </div>
          )}
        </div>

        <div className="pst-body">
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "4px 0" }}>
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {!isTerminal && (
                <>
                  <motion.div
                    animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
                    style={{ position: "absolute", width: 80, height: 80, borderRadius: "50%", border: `1.5px solid rgba(245,166,35,0.3)` }}
                  />
                  <motion.div
                    animate={{ scale: [1, 1.7, 1], opacity: [0.2, 0, 0.2] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
                    style={{ position: "absolute", width: 80, height: 80, borderRadius: "50%", border: `1px solid rgba(245,166,35,0.15)` }}
                  />
                </>
              )}
              <div style={{
                width: 64, height: 64, borderRadius: "50%",
                background: isCompleted ? "rgba(200,241,53,0.08)" : isFailed ? "rgba(239,68,68,0.08)" : "rgba(245,166,35,0.08)",
                border: `1.5px solid ${isCompleted ? "rgba(200,241,53,0.3)" : isFailed ? "rgba(239,68,68,0.3)" : "rgba(245,166,35,0.3)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {isCompleted ? (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 20 }}>
                    <CheckCircle2 size={28} color={C.lime} />
                  </motion.div>
                ) : isFailed ? (
                  <XCircle size={28} color={C.error} />
                ) : (
                  <AuronLogo size={32} />
                )}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {STEPS.map(({ label, desc }, i) => {
              const done    = activeStepIdx > i || isCompleted;
              const active  = !isCompleted && activeStepIdx === i;
              const pending = !done && !active;

              return (
                <div key={label} className="pst-step">
                  <div className="pst-step-left">
                    <motion.div
                      className={`pst-node ${done ? "pst-node-done" : active ? "pst-node-active" : "pst-node-pending"}`}
                      animate={active ? { scale: [1, 1.1, 1] } : {}}
                      transition={{ duration: 1.4, repeat: active ? Infinity : 0 }}
                    >
                      {done ? (
                        <CheckCircle2 size={14} color={C.lime} />
                      ) : active ? (
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}>
                          <RefreshCw size={12} color={C.gold} />
                        </motion.div>
                      ) : (
                        <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, fontWeight: 700, color: C.border }}>{i + 1}</span>
                      )}
                    </motion.div>
                    {i < STEPS.length - 1 && (
                      <div className="pst-connector" style={{ background: done ? `rgba(200,241,53,0.25)` : C.border }} />
                    )}
                  </div>

                  <div className="pst-step-content">
                    <div>
                      <p style={{ fontSize: 13, fontWeight: done || active ? 600 : 400, color: done ? C.lime : active ? C.gold : C.dim, margin: "0 0 2px" }}>
                        {label}
                      </p>
                      <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, margin: 0 }}>{desc}</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      {done && <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim }}>{stepTimes[i]}s</span>}
                      {done && <CheckCircle2 size={13} color={C.lime} />}
                      {active && (
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}>
                          <RefreshCw size={12} color={C.gold} />
                        </motion.div>
                      )}
                      {pending && <div style={{ width: 13, height: 13, borderRadius: "50%", background: C.s2, border: `1px solid ${C.border}` }} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {isCompleted && totalSecs && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="pst-summary"
              style={{ background: "rgba(200,241,53,0.04)", border: `1px solid rgba(200,241,53,0.15)` }}
            >
              <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: "0 0 4px" }}>
                ₹{payment.inrAmount.toLocaleString("en-IN")} delivered to merchant
              </p>
              <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.lime, margin: 0 }}>
                Settled in {totalSecs}s
              </p>
            </motion.div>
          )}

          <AnimatePresence>
            {isFailed && payment.failureReason && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="pst-error">
                <AlertTriangle size={14} color={C.error} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: C.error, margin: "0 0 2px" }}>What went wrong</p>
                  <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: "rgba(239,68,68,0.7)", margin: 0, lineHeight: 1.5 }}>
                    {payment.failureReason}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {(isRefunding || isRefunded) && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                style={{ padding: "12px 14px", borderRadius: 10, background: isRefunded ? "rgba(200,241,53,0.04)" : "rgba(245,166,35,0.04)", border: `1px solid ${isRefunded ? "rgba(200,241,53,0.15)" : "rgba(245,166,35,0.15)"}`, display: "flex", alignItems: "center", gap: 10 }}>
                {isRefunded
                  ? <CheckCircle2 size={13} color={C.lime} />
                  : <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}><RotateCcw size={13} color={C.gold} /></motion.div>}
                <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: isRefunded ? C.lime : C.gold, margin: 0 }}>
                  {isRefunded ? `${payment.usdcAmount.toFixed(4)} USDC refunded.` : "Refund in progress…"}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {payment.solanaSignature && (
            <div className="pst-tx-row">
              <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.dim }}>
                {payment.solanaSignature.slice(0, 10)}…{payment.solanaSignature.slice(-6)}
              </span>
              <a href={getTxExplorerUrl(payment.solanaSignature)} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "'Geist Mono',monospace", fontSize: 11, fontWeight: 600, color: C.usdc, textDecoration: "none" }}>
                Solscan <ExternalLink size={10} />
              </a>
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            {isFailed && (
              <>
                {onRetry && (
                  <button className="pst-btn-secondary" onClick={onRetry}>
                    <RefreshCw size={12} /> Retry
                  </button>
                )}
                {onRequestRefund && (
                  <button className="pst-btn-secondary" onClick={onRequestRefund}>
                    <RotateCcw size={12} /> Refund
                  </button>
                )}
              </>
            )}
            {isCompleted && onViewReceipt && (
              <button className="pst-btn-primary" onClick={onViewReceipt}>
                View Receipt
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            )}
            {(isTerminal || onDismiss) && (
              <button className="pst-btn-ghost" onClick={onDismiss}>Close</button>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}
