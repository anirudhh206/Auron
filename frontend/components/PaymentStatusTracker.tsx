"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, XCircle, RefreshCw, Clock, Zap,
  ArrowRight, AlertTriangle, RotateCcw,
} from "lucide-react";
import {
  PaymentRecord,
  PaymentStatus,
  STATUS_LABELS,
  STATUS_STEPS,
  getStepIndex,
  quoteSecondsRemaining,
} from "@/lib/payment-state";

// ─── Props ────────────────────────────────────────────────────────────────────
interface PaymentStatusTrackerProps {
  payment: PaymentRecord;
  onRetry?: () => void;
  onRequestRefund?: () => void;
  onDismiss?: () => void;
  onViewReceipt?: () => void;
}

// ─── Step config ──────────────────────────────────────────────────────────────
const STEPS: { status: PaymentStatus; label: string; sublabel: string }[] = [
  { status: "awaiting_signature", label: "Sign",    sublabel: "Authorize in Phantom" },
  { status: "tx_pending",         label: "Chain",   sublabel: "Solana confirming" },
  { status: "tx_confirmed",       label: "On-chain",sublabel: "USDC transferred" },
  { status: "offramp_initiated",  label: "Off-ramp",sublabel: "OnMeta converting" },
  { status: "completed",          label: "Paid",    sublabel: "Merchant received ₹" },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function PaymentStatusTracker({
  payment,
  onRetry,
  onRequestRefund,
  onDismiss,
  onViewReceipt,
}: PaymentStatusTrackerProps) {
  const [secondsLeft, setSecondsLeft] = useState(quoteSecondsRemaining(payment));

  // Quote expiry countdown
  useEffect(() => {
    if (payment.status !== "idle" && payment.status !== "awaiting_signature") return;
    const interval = setInterval(() => {
      setSecondsLeft(quoteSecondsRemaining(payment));
    }, 1000);
    return () => clearInterval(interval);
  }, [payment]);

  const isCompleted  = payment.status === "completed";
  const isFailed     = payment.status === "failed";
  const isRefunded   = payment.status === "refunded";
  const isRefunding  = payment.status === "refund_pending";
  const isTerminal   = isCompleted || isFailed || isRefunded;

  const activeStepIdx = getStepIndex(payment.status);
  const elapsedMs = payment.completedAt
    ? payment.completedAt - payment.initiatedAt
    : Date.now() - payment.initiatedAt;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 380, damping: 36 }}
      className="w-full max-w-sm mx-auto rounded-2xl overflow-hidden"
      style={{
        background: "rgba(10,10,15,0.98)",
        border: `1px solid ${isCompleted ? "rgba(16,185,129,0.3)" : isFailed ? "rgba(239,68,68,0.3)" : "rgba(201,168,76,0.2)"}`,
        backdropFilter: "blur(24px)",
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          background: isCompleted
            ? "rgba(16,185,129,0.06)"
            : isFailed
            ? "rgba(239,68,68,0.06)"
            : "rgba(201,168,76,0.05)",
        }}
      >
        <div className="flex items-center gap-3">
          <StatusIcon status={payment.status} />
          <div className="leading-tight">
            <p className="text-sm font-bold text-white">{STATUS_LABELS[payment.status]}</p>
            <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
              {payment.merchantName} · ₹{payment.inrAmount.toLocaleString("en-IN")}
            </p>
          </div>
        </div>

        {/* Quote expiry */}
        {!isTerminal && secondsLeft > 0 && secondsLeft < 60 && (
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-lg"
            style={{
              background: secondsLeft < 15 ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${secondsLeft < 15 ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.08)"}`,
            }}
          >
            <Clock size={10} style={{ color: secondsLeft < 15 ? "#f87171" : "var(--text-muted)" }} />
            <span className="text-[10px] font-mono font-semibold"
              style={{ color: secondsLeft < 15 ? "#f87171" : "var(--text-muted)" }}>
              {secondsLeft}s
            </span>
          </div>
        )}
      </div>

      {/* ── Step pipeline ──────────────────────────────────────────── */}
      {!isFailed && !isRefunding && !isRefunded && (
        <div className="px-5 py-4">
          <div className="flex items-center justify-between relative">
            {/* Connecting line */}
            <div className="absolute left-4 right-4 top-4 h-[1px]" style={{ background: "rgba(255,255,255,0.06)" }} />

            {STEPS.map((step, i) => {
              const done = activeStepIdx > i || isCompleted;
              const active = !isCompleted && activeStepIdx === i;
              return (
                <div key={step.status} className="relative flex flex-col items-center gap-1.5 z-10" style={{ minWidth: "48px" }}>
                  {/* Dot */}
                  <motion.div
                    animate={active ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ duration: 1.4, repeat: active ? Infinity : 0, ease: "easeInOut" }}
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{
                      background: done
                        ? "rgba(16,185,129,0.2)"
                        : active
                        ? "rgba(201,168,76,0.18)"
                        : "rgba(255,255,255,0.04)",
                      border: `1.5px solid ${
                        done ? "rgba(16,185,129,0.5)" : active ? "rgba(201,168,76,0.5)" : "rgba(255,255,255,0.1)"
                      }`,
                    }}
                  >
                    {done ? (
                      <CheckCircle2 size={13} className="text-emerald-400" />
                    ) : active ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                      >
                        <RefreshCw size={12} style={{ color: "#C9A84C" }} />
                      </motion.div>
                    ) : (
                      <span className="text-[9px] font-bold" style={{ color: "rgba(255,255,255,0.2)" }}>
                        {i + 1}
                      </span>
                    )}
                  </motion.div>

                  {/* Label */}
                  <p className="text-[9px] font-semibold text-center leading-tight"
                    style={{
                      color: done ? "#10b981" : active ? "#C9A84C" : "rgba(255,255,255,0.2)",
                    }}>
                    {step.label}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Active step sublabel */}
          <AnimatePresence mode="wait">
            <motion.p
              key={payment.status}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="text-center mt-3 text-[11px]"
              style={{ color: "var(--text-muted)" }}
            >
              {STEPS.find((s) => s.status === payment.status)?.sublabel ?? "Processing…"}
            </motion.p>
          </AnimatePresence>
        </div>
      )}

      {/* ── Payment details ────────────────────────────────────────── */}
      <div className="px-5 pb-1 space-y-2">
        <div className="rounded-xl p-3 space-y-2"
          style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>

          <DetailRow label="Payment ID" value={payment.paymentId.slice(0, 8) + "…"} mono />
          <DetailRow label="USDC spent" value={`${payment.usdcAmount.toFixed(6)} USDC`} />
          <DetailRow label="Merchant" value={payment.merchantName || payment.merchantUpiId} />
          <DetailRow label="UPI ID" value={payment.merchantUpiId} mono />

          {payment.utrNumber && (
            <DetailRow label="UTR" value={payment.utrNumber} mono gold />
          )}
          {payment.solanaSignature && (
            <DetailRow
              label="Tx"
              value={payment.solanaSignature.slice(0, 8) + "…" + payment.solanaSignature.slice(-4)}
              mono
            />
          )}
          {isCompleted && payment.receiptHash && (
            <DetailRow
              label="Receipt hash"
              value={payment.receiptHash.slice(0, 12) + "…"}
              mono
            />
          )}
          {isTerminal && (
            <DetailRow
              label="Duration"
              value={`${(elapsedMs / 1000).toFixed(1)}s`}
            />
          )}
        </div>
      </div>

      {/* ── Failure panel ──────────────────────────────────────────── */}
      <AnimatePresence>
        {isFailed && payment.failureReason && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-5 mt-2"
          >
            <div className="rounded-xl p-3"
              style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
              <div className="flex items-start gap-2">
                <AlertTriangle size={13} className="text-red-400 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-red-300">What went wrong</p>
                  <p className="text-[10px] leading-relaxed" style={{ color: "rgba(239,68,68,0.8)" }}>
                    {payment.failureReason}
                  </p>
                  {payment.retryCount > 0 && (
                    <p className="text-[10px]" style={{ color: "rgba(239,68,68,0.6)" }}>
                      Failed after {payment.retryCount} {payment.retryCount === 1 ? "retry" : "retries"}.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Refund status ──────────────────────────────────────────── */}
      <AnimatePresence>
        {(isRefunding || isRefunded) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-5 mt-2"
          >
            <div className="rounded-xl p-3 flex items-center gap-2"
              style={{
                background: isRefunded ? "rgba(16,185,129,0.08)" : "rgba(201,168,76,0.06)",
                border: `1px solid ${isRefunded ? "rgba(16,185,129,0.25)" : "rgba(201,168,76,0.2)"}`,
              }}>
              {isRefunded
                ? <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                : <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}>
                    <RotateCcw size={13} style={{ color: "#C9A84C" }} />
                  </motion.div>
              }
              <p className="text-[11px]" style={{ color: isRefunded ? "#10b981" : "#C9A84C" }}>
                {isRefunded
                  ? `${payment.usdcAmount.toFixed(4)} USDC refunded to your wallet.`
                  : "Refund in progress — USDC returning to your wallet…"}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Action buttons ─────────────────────────────────────────── */}
      <div className="px-5 pb-5 pt-3 flex gap-2">
        {isFailed && (
          <>
            {onRetry && (
              <motion.button
                onClick={onRetry}
                whileTap={{ scale: 0.97 }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all"
                style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.25)", color: "#C9A84C" }}
              >
                <RefreshCw size={12} /> Retry
              </motion.button>
            )}
            {onRequestRefund && (
              <motion.button
                onClick={onRequestRefund}
                whileTap={{ scale: 0.97 }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-secondary)" }}
              >
                <RotateCcw size={12} /> Refund
              </motion.button>
            )}
          </>
        )}

        {isCompleted && (
          <>
            {onViewReceipt && (
              <motion.button
                onClick={onViewReceipt}
                whileTap={{ scale: 0.97 }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold btn-gold text-[#0A0A0F]"
              >
                View Receipt <ArrowRight size={12} />
              </motion.button>
            )}
          </>
        )}

        {(isTerminal || onDismiss) && (
          <button
            onClick={onDismiss}
            className="py-2.5 px-4 rounded-xl text-xs font-medium transition-all"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              color: "var(--text-muted)",
            }}
          >
            Close
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Status icon ──────────────────────────────────────────────────────────────
function StatusIcon({ status }: { status: PaymentStatus }) {
  if (status === "completed") {
    return (
      <motion.div
        initial={{ scale: 0 }} animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 20 }}
        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}
      >
        <CheckCircle2 size={16} className="text-emerald-400" />
      </motion.div>
    );
  }
  if (status === "failed") {
    return (
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}>
        <XCircle size={16} className="text-red-400" />
      </div>
    );
  }
  if (status === "refunded") {
    return (
      <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)" }}>
        <CheckCircle2 size={16} className="text-emerald-400" />
      </div>
    );
  }
  return (
    <motion.div
      animate={{ scale: [1, 1.08, 1] }}
      transition={{ duration: 1.6, repeat: Infinity }}
      className="w-8 h-8 rounded-xl btn-gold flex items-center justify-center shrink-0"
    >
      <Zap size={14} fill="currentColor" className="text-[#0A0A0F]" />
    </motion.div>
  );
}

// ─── Detail row ───────────────────────────────────────────────────────────────
function DetailRow({
  label, value, mono = false, gold = false,
}: {
  label: string; value: string; mono?: boolean; gold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span
        className={`text-[10px] font-semibold truncate text-right ${mono ? "font-mono" : ""}`}
        style={{ color: gold ? "#C9A84C" : "var(--text-secondary)" }}
      >
        {value}
      </span>
    </div>
  );
}
