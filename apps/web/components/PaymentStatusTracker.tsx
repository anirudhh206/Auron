"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, XCircle, RefreshCw, Clock,
  AlertTriangle, RotateCcw, ExternalLink, Copy, Check,
} from "lucide-react";
import AuronLogo from "@/components/AuronLogo";
import {
  PaymentRecord, PaymentStatus, STATUS_LABELS,
  getStepIndex, quoteSecondsRemaining,
} from "@/lib/payment-state";
import { getTxExplorerUrl } from "@/lib/solana";

interface PaymentStatusTrackerProps {
  payment: PaymentRecord;
  onRetry?: () => void;
  onRequestRefund?: () => void;
  onDismiss?: () => void;
  onViewReceipt?: () => void;
}

const STEPS: { status: PaymentStatus; label: string; desc: string }[] = [
  { status: "awaiting_signature", label: "Quote Generated",    desc: "Rate locked, ready to sign" },
  { status: "tx_pending",         label: "Wallet Signed",      desc: "Transaction broadcasting" },
  { status: "tx_confirmed",       label: "USDC Received",      desc: "On-chain confirmed" },
  { status: "offramp_initiated",  label: "Settlement Verified", desc: "Off-ramp initiated" },
  { status: "completed",          label: "UPI Delivered",      desc: "Merchant paid" },
];

export default function PaymentStatusTracker({
  payment, onRetry, onRequestRefund, onDismiss, onViewReceipt,
}: PaymentStatusTrackerProps) {
  const [secondsLeft, setSecondsLeft] = useState(quoteSecondsRemaining(payment));
  const [stepTimes]   = useState<number[]>(() => [2.4, 1.8, 3.2, 2.1, 3.2]);

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 380, damping: 36 }}
      style={{
        width: "100%", maxWidth: 380, margin: "0 auto",
        borderRadius: 24, overflow: "hidden",
        background: "#07090D",
        border: `1px solid ${isCompleted ? "rgba(34,197,94,0.25)" : isFailed ? "rgba(239,68,68,0.25)" : "rgba(59,130,246,0.2)"}`,
        boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
      }}
    >
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(148,163,184,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>
          {isCompleted ? "Payment Complete" : isFailed ? "Payment Failed" : "Payment in Progress"}
        </span>
        {!isTerminal && secondsLeft > 0 && secondsLeft < 60 && (
          <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, background: secondsLeft < 15 ? "rgba(239,68,68,0.1)" : "rgba(148,163,184,0.06)", border: `1px solid ${secondsLeft < 15 ? "rgba(239,68,68,0.3)" : "rgba(148,163,184,0.1)"}` }}>
            <Clock size={10} color={secondsLeft < 15 ? "#F87171" : "var(--text-muted)"} />
            <span style={{ fontSize: 10, fontFamily: "monospace", fontWeight: 700, color: secondsLeft < 15 ? "#F87171" : "var(--text-muted)" }}>{secondsLeft}s</span>
          </div>
        )}
      </div>

      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Auron logo with animated ring */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "8px 0" }}>
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {/* Animated rings */}
            {!isTerminal && (
              <>
                <motion.div
                  animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                  style={{ position: "absolute", width: 80, height: 80, borderRadius: "50%", border: "2px solid rgba(59,130,246,0.4)" }}
                />
                <motion.div
                  animate={{ scale: [1, 1.6, 1], opacity: [0.3, 0, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
                  style={{ position: "absolute", width: 80, height: 80, borderRadius: "50%", border: "1px solid rgba(59,130,246,0.25)" }}
                />
              </>
            )}
            {/* Center icon */}
            <div style={{
              width: 64, height: 64, borderRadius: "50%",
              background: isCompleted ? "rgba(34,197,94,0.1)" : isFailed ? "rgba(239,68,68,0.1)" : "rgba(59,130,246,0.1)",
              border: `2px solid ${isCompleted ? "rgba(34,197,94,0.4)" : isFailed ? "rgba(239,68,68,0.4)" : "rgba(59,130,246,0.4)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: isCompleted ? "0 0 32px rgba(34,197,94,0.2)" : isFailed ? "0 0 32px rgba(239,68,68,0.2)" : "0 0 32px rgba(59,130,246,0.2)",
            }}>
              {isCompleted ? (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 20 }}>
                  <CheckCircle2 size={28} color="#22C55E" />
                </motion.div>
              ) : isFailed ? (
                <XCircle size={28} color="#EF4444" />
              ) : (
                <AuronLogo size={32} />
              )}
            </div>
          </div>
        </div>

        {/* Step timeline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {STEPS.map(({ label, desc }, i) => {
            const done   = activeStepIdx > i || isCompleted;
            const active = !isCompleted && activeStepIdx === i;
            const upcoming = !done && !active;

            return (
              <div key={label} style={{ display: "flex", gap: 14, position: "relative" }}>
                {/* Vertical line */}
                {i < STEPS.length - 1 && (
                  <div style={{ position: "absolute", left: 16, top: 32, bottom: -4, width: 2, background: done ? "rgba(34,197,94,0.3)" : "rgba(148,163,184,0.08)", transition: "background 0.4s" }} />
                )}

                {/* Step dot */}
                <div style={{ flexShrink: 0, zIndex: 1, paddingTop: 8 }}>
                  <motion.div
                    animate={active ? { scale: [1, 1.15, 1] } : {}}
                    transition={{ duration: 1.4, repeat: active ? Infinity : 0 }}
                    style={{
                      width: 32, height: 32, borderRadius: "50%",
                      background: done ? "rgba(34,197,94,0.15)" : active ? "rgba(59,130,246,0.15)" : "rgba(148,163,184,0.06)",
                      border: `1.5px solid ${done ? "rgba(34,197,94,0.5)" : active ? "rgba(59,130,246,0.5)" : "rgba(148,163,184,0.15)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {done ? (
                      <CheckCircle2 size={14} color="#22C55E" />
                    ) : active ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}>
                        <RefreshCw size={12} color="#3B82F6" />
                      </motion.div>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 700, color: "rgba(148,163,184,0.3)" }}>{i + 1}</span>
                    )}
                  </motion.div>
                </div>

                {/* Step content */}
                <div style={{ flex: 1, padding: "8px 0 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: done || active ? 600 : 400, color: done ? "var(--text-primary)" : active ? "#60A5FA" : "var(--text-muted)", margin: "0 0 2px" }}>
                      {label}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>{desc}</p>
                  </div>
                  {/* Time */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {done && (
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "monospace" }}>{stepTimes[i]} sec</span>
                    )}
                    {done && <CheckCircle2 size={14} color="#22C55E" />}
                    {active && <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}><RefreshCw size={13} color="#3B82F6" /></motion.div>}
                    {upcoming && <div style={{ width: 14, height: 14, borderRadius: "50%", background: "rgba(148,163,184,0.1)", border: "1px solid rgba(148,163,184,0.15)" }} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Completion summary */}
        {isCompleted && totalSecs && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", textAlign: "center" }}
          >
            <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 4px" }}>
              Merchant received ₹{payment.inrAmount.toLocaleString("en-IN")}
            </p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Check size={12} color="#22C55E" />
              <span style={{ fontSize: 12, color: "#22C55E" }}>Completed in {totalSecs} seconds</span>
            </div>
          </motion.div>
        )}

        {/* Failure panel */}
        <AnimatePresence>
          {isFailed && payment.failureReason && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", gap: 10 }}>
              <AlertTriangle size={14} color="#F87171" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#F87171", margin: "0 0 2px" }}>What went wrong</p>
                <p style={{ fontSize: 11, color: "rgba(248,113,113,0.7)", margin: 0 }}>{payment.failureReason}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Refund status */}
        <AnimatePresence>
          {(isRefunding || isRefunded) && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              style={{ padding: "12px 14px", borderRadius: 12, background: isRefunded ? "rgba(34,197,94,0.08)" : "rgba(59,130,246,0.08)", border: `1px solid ${isRefunded ? "rgba(34,197,94,0.2)" : "rgba(59,130,246,0.2)"}`, display: "flex", alignItems: "center", gap: 10 }}>
              {isRefunded
                ? <CheckCircle2 size={13} color="#22C55E" />
                : <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}><RotateCcw size={13} color="#3B82F6" /></motion.div>}
              <p style={{ fontSize: 11, color: isRefunded ? "#22C55E" : "#60A5FA", margin: 0 }}>
                {isRefunded ? `${payment.usdcAmount.toFixed(4)} USDC refunded to your wallet.` : "Refund in progress…"}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Solana proof link */}
        {payment.solanaSignature && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 10, background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.08)" }}>
            <span style={{ fontSize: 11, fontFamily: "monospace", color: "var(--text-muted)" }}>
              {payment.solanaSignature.slice(0, 10)}…{payment.solanaSignature.slice(-6)}
            </span>
            <a href={getTxExplorerUrl(payment.solanaSignature)} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#60A5FA", textDecoration: "none" }}>
              Solscan <ExternalLink size={11} />
            </a>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          {isFailed && (
            <>
              {onRetry && (
                <button onClick={onRetry}
                  style={{ flex: 1, padding: "11px", borderRadius: 12, background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)", fontSize: 13, fontWeight: 600, color: "#60A5FA", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <RefreshCw size={12} /> Retry
                </button>
              )}
              {onRequestRefund && (
                <button onClick={onRequestRefund}
                  style={{ flex: 1, padding: "11px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(148,163,184,0.12)", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <RotateCcw size={12} /> Refund
                </button>
              )}
            </>
          )}
          {isCompleted && onViewReceipt && (
            <button onClick={onViewReceipt}
              style={{ flex: 1, padding: "13px", borderRadius: 12, background: "#3B82F6", border: "none", fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 16px rgba(59,130,246,0.35)" }}>
              View Receipt <ArrowRight size={14} />
            </button>
          )}
          {(isTerminal || onDismiss) && (
            <button onClick={onDismiss}
              style={{ flex: isCompleted && onViewReceipt ? undefined : 1, padding: "11px 20px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(148,163,184,0.1)", fontSize: 13, color: "var(--text-muted)", cursor: "pointer" }}>
              Close
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function ArrowRight({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}
