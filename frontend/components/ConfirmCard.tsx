"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Zap, ShieldAlert, Clock, ArrowRight } from "lucide-react";
import { SecurityFlag } from "@/lib/security";
import { ParsedAction } from "@/lib/claude";

interface ConfirmCardProps {
  readonly confirmText: string;
  readonly action: ParsedAction;
  readonly securityFlags: SecurityFlag[];
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly isExecuting: boolean;
}

const ACTION_META: Record<string, { icon: string; label: string; color: string }> = {
  transfer:        { icon: "💸", label: "Transfer",        color: "rgba(201,168,76,0.15)" },
  transfer_sol:    { icon: "◎",  label: "Send SOL",        color: "rgba(201,168,76,0.15)" },
  transfer_usdc:   { icon: "💵", label: "Send USDC",       color: "rgba(201,168,76,0.15)" },
  upi_payment:     { icon: "🇮🇳", label: "UPI Payment",   color: "rgba(16,185,129,0.12)"  },
  stamp_agreement: { icon: "🤝", label: "Record Agreement", color: "rgba(59,130,246,0.12)" },
  lock_savings:    { icon: "🔒", label: "Lock Savings",    color: "rgba(139,92,246,0.12)"  },
  stamp_ownership: { icon: "📎", label: "Prove Ownership", color: "rgba(245,158,11,0.12)"  },
};

export default function ConfirmCard({
  confirmText,
  action,
  securityFlags,
  onConfirm,
  onCancel,
  isExecuting,
}: ConfirmCardProps) {
  const [cooldown, setCooldown] = useState(0);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdRef = useRef<NodeJS.Timeout | null>(null);
  const holdStart = useRef<number>(0);
  const progressBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    progressBarRef.current?.style.setProperty("--hold-progress", `${holdProgress * 100}%`);
  }, [holdProgress]);

  const urgencyFlag = securityFlags.find((f) => f.type === "URGENCY_DETECTED");
  const aboveFlag   = securityFlags.find(
    (f) => f.type === "ABOVE_CEILING" || f.type === "EXTREME_AMOUNT"
  );
  const needsHold = !!aboveFlag;
  const holdMs    = aboveFlag && "holdDurationMs" in aboveFlag ? aboveFlag.holdDurationMs : 0;

  useEffect(() => {
    if (!urgencyFlag) return;
    setCooldown(60);
    const interval = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) { clearInterval(interval); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [urgencyFlag]);

  const buttonBlocked = cooldown > 0 || isExecuting;

  const startHold = () => {
    if (buttonBlocked) return;
    holdStart.current = Date.now();
    const tick = () => {
      const elapsed = Date.now() - holdStart.current;
      const progress = Math.min(elapsed / holdMs, 1);
      setHoldProgress(progress);
      if (progress < 1) {
        holdRef.current = setTimeout(tick, 16);
      } else {
        onConfirm();
      }
    };
    holdRef.current = setTimeout(tick, 16);
  };

  const cancelHold = () => {
    if (holdRef.current) clearTimeout(holdRef.current);
    setHoldProgress(0);
  };

  const meta        = ACTION_META[action.action ?? "transfer"] ?? ACTION_META.transfer;
  const isUPI       = action.action === "upi_payment";
  const isSavings   = action.action === "lock_savings";
  const isStamp     = action.action === "stamp_agreement" || action.action === "stamp_ownership";
  const showDetails = !isUPI && (action.amount != null || action.amount_usdc != null || action.recipient);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
      onClick={(e) => e.target === e.currentTarget && !isExecuting && onCancel()}
    >
      <motion.div
        initial={{ y: 60, opacity: 0, scale: 0.97 }}
        animate={{ y: 0,  opacity: 1, scale: 1    }}
        exit={{    y: 40, opacity: 0, scale: 0.97 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{
          background:   "var(--bg-elevated)",
          border:       "1px solid rgba(201,168,76,0.18)",
          borderBottom: "1px solid rgba(201,168,76,0.18)",
          boxShadow:    "0 -8px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(201,168,76,0.06) inset",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle — mobile only */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.15)" }} />
        </div>

        {/* Top glow bar */}
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(201,168,76,0.5), transparent)" }} />

        <div className="px-5 pt-4 pb-5 sm:px-6 sm:pt-5 sm:pb-6 space-y-4">

          {/* ── Header ─────────────────────────────────────────────── */}
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-2xl"
              style={{ background: meta.color, border: "1px solid rgba(255,255,255,0.06)" }}>
              {meta.icon}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-xs font-bold tracking-widest uppercase mb-0.5"
                style={{ color: "var(--auron-gold)", opacity: 0.75 }}>
                {meta.label}
              </p>
              <p className="font-semibold leading-snug" style={{ color: "var(--text-primary)", fontSize: "15px" }}>
                {confirmText}
              </p>
            </div>
          </div>

          {/* ── Security alerts ─────────────────────────────────────── */}
          <AnimatePresence>
            {urgencyFlag && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                className="rounded-xl p-3.5 flex gap-3"
                style={{ background: "rgba(226,75,74,0.1)", border: "1px solid rgba(226,75,74,0.25)" }}
              >
                <ShieldAlert size={16} className="shrink-0 mt-0.5" style={{ color: "var(--error)" }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: "#f87171" }}>Urgency language detected</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(248,113,113,0.75)" }}>
                    Scammers create false urgency.
                    {cooldown > 0 && <span className="font-bold"> Please wait {cooldown}s.</span>}
                  </p>
                </div>
              </motion.div>
            )}

            {aboveFlag && (
              <motion.div
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                className="rounded-xl p-3.5 flex gap-3"
                style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.25)" }}
              >
                <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-400" />
                <div>
                  <p className="text-sm font-semibold text-amber-300">
                    {aboveFlag.type === "EXTREME_AMOUNT" ? "Unusually large amount" : "Above your spend ceiling"}
                  </p>
                  <p className="text-xs mt-0.5 text-amber-400/75">Hold the confirm button to proceed.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── UPI payment breakdown ─────────────────────────────── */}
          {isUPI && (
            <div className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(201,168,76,0.15)" }}>
              {/* Label bar */}
              <div className="px-4 py-2.5 flex items-center gap-2"
                style={{ background: "rgba(201,168,76,0.07)", borderBottom: "1px solid rgba(201,168,76,0.1)" }}>
                <Zap size={11} style={{ color: "rgba(201,168,76,0.8)" }} />
                <span className="text-[10px] font-bold tracking-widest uppercase"
                  style={{ color: "rgba(201,168,76,0.8)" }}>
                  UPI · Auron Off-Ramp
                </span>
              </div>

              {/* Rows */}
              <div className="px-4 py-3 space-y-2.5"
                style={{ background: "rgba(10,10,15,0.4)" }}>
                <DetailRow label="Merchant" value={action.merchant_name ?? action.upi_id?.split("@")[0] ?? "—"} bold />
                <DetailRow label="UPI ID"   value={action.upi_id ?? "—"} mono small />
                <DetailRow label="You spend"
                  value={action.amount_usdc != null ? `${action.amount_usdc.toFixed(4)} USDC` : "—"}
                  bold />

                {/* Arrow */}
                <div className="flex items-center gap-2 py-1">
                  <div className="flex-1 h-px" style={{ background: "rgba(201,168,76,0.08)" }} />
                  <ArrowRight size={11} style={{ color: "rgba(201,168,76,0.4)" }} />
                  <div className="flex-1 h-px" style={{ background: "rgba(201,168,76,0.08)" }} />
                </div>

                <DetailRow
                  label="Merchant gets"
                  value={action.inr_amount != null ? `₹${action.inr_amount.toLocaleString("en-IN")}` : "—"}
                  valueColor="#10b981"
                  bold
                />

                {/* Zero-fee badge */}
                <div className="flex justify-between items-center rounded-xl px-3 py-2 mt-1"
                  style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.18)" }}>
                  <span className="text-xs font-semibold text-emerald-400">Your fee</span>
                  <span className="text-sm font-black text-emerald-400">₹0</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Generic amount + recipient ─────────────────────────── */}
          {showDetails && (
            <div className="rounded-2xl p-4 grid grid-cols-2 gap-4"
              style={{ background: "rgba(10,10,15,0.5)", border: "1px solid rgba(255,255,255,0.05)" }}>
              {(action.amount_usdc != null || action.amount != null) && (
                <div>
                  <p className="text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>
                    {isSavings ? "Locking" : isStamp ? "Amount" : "Amount"}
                  </p>
                  <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                    {action.amount_usdc != null
                      ? `${action.amount_usdc.toFixed(2)} USDC`
                      : action.action === "transfer_sol"
                        ? `${action.amount} SOL`
                        : `${action.amount?.toLocaleString()}`}
                  </p>
                </div>
              )}
              {action.recipient && (
                <div className="min-w-0">
                  <p className="text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>To</p>
                  <p className="font-bold text-sm font-mono truncate" style={{ color: "var(--text-primary)" }}>
                    {action.recipient.length > 16
                      ? `${action.recipient.slice(0, 6)}…${action.recipient.slice(-4)}`
                      : action.recipient}
                  </p>
                </div>
              )}
              {action.duration_days && (
                <div>
                  <p className="text-[11px] mb-1" style={{ color: "var(--text-muted)" }}>Duration</p>
                  <p className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                    {action.duration_days >= 365
                      ? `${Math.round(action.duration_days / 365)} yr`
                      : action.duration_days >= 30
                        ? `${Math.round(action.duration_days / 30)} mo`
                        : `${action.duration_days} days`}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Cooldown timer ────────────────────────────────────── */}
          {cooldown > 0 && (
            <div className="flex items-center justify-center gap-2 py-1">
              <Clock size={13} style={{ color: "var(--text-muted)" }} />
              <span className="text-xs tabular-nums" style={{ color: "var(--text-muted)" }}>
                Confirm available in <span className="font-bold text-amber-400">{cooldown}s</span>
              </span>
            </div>
          )}

          {/* ── Action buttons ────────────────────────────────────── */}
          <div className="flex gap-3 pt-1">
            {/* Cancel */}
            <button
              onClick={onCancel}
              disabled={isExecuting}
              className="flex-1 py-3.5 rounded-2xl font-semibold text-sm transition-all duration-150 disabled:opacity-40"
              style={{
                border:  "1px solid rgba(255,255,255,0.1)",
                color:   "var(--text-secondary)",
                background: "rgba(255,255,255,0.04)",
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
            >
              Cancel
            </button>

            {/* Confirm / Hold */}
            {needsHold ? (
              <button
                onMouseDown={startHold}
                onMouseUp={cancelHold}
                onMouseLeave={cancelHold}
                onTouchStart={startHold}
                onTouchEnd={cancelHold}
                disabled={buttonBlocked}
                aria-label="Hold to confirm"
                className="flex-1 relative py-3.5 rounded-2xl font-bold text-sm overflow-hidden disabled:opacity-40 select-none"
                style={{ background: "linear-gradient(135deg, #C9A84C, #A07830)", color: "#0A0A0F" }}
              >
                {/* Fill overlay */}
                <div
                  ref={progressBarRef}
                  className="absolute left-0 top-0 h-full hold-bar transition-none"
                  style={{ background: "rgba(255,255,255,0.25)" }}
                />
                <span className="relative flex items-center justify-center gap-1.5">
                  <span>Hold to confirm</span>
                  {holdProgress > 0 && (
                    <span className="text-[10px] opacity-80 tabular-nums">
                      {Math.round(holdProgress * 100)}%
                    </span>
                  )}
                </span>
              </button>
            ) : (
              <button
                onClick={!buttonBlocked ? onConfirm : undefined}
                disabled={buttonBlocked}
                aria-label={isUPI ? "Confirm UPI payment" : "Confirm transaction"}
                className="flex-1 py-3.5 rounded-2xl font-bold text-sm transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{
                  background: buttonBlocked ? "rgba(201,168,76,0.3)" : "linear-gradient(135deg, #C9A84C, #A07830)",
                  color: "#0A0A0F",
                  boxShadow: buttonBlocked ? "none" : "0 4px 20px rgba(201,168,76,0.35)",
                }}
                onMouseEnter={e => {
                  if (!buttonBlocked) e.currentTarget.style.boxShadow = "0 6px 28px rgba(201,168,76,0.55)";
                }}
                onMouseLeave={e => {
                  if (!buttonBlocked) e.currentTarget.style.boxShadow = "0 4px 20px rgba(201,168,76,0.35)";
                }}
              >
                {isExecuting ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-[#0A0A0F]/30 border-t-[#0A0A0F] animate-spin" />
                    <span>{isUPI ? "Processing…" : "Sending…"}</span>
                  </>
                ) : cooldown > 0 ? (
                  `Wait ${cooldown}s`
                ) : (
                  <>
                    <span>{isUPI ? "Pay now" : "Confirm"}</span>
                    <Zap size={14} fill="currentColor" />
                  </>
                )}
              </button>
            )}
          </div>

          {/* Security footnote */}
          <p className="text-center text-[10px]" style={{ color: "var(--text-muted)" }}>
            🔒 Signed by your Phantom wallet · Never shared with Auron
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Detail row helper ─────────────────────────────────────────
function DetailRow({
  label,
  value,
  bold,
  mono,
  small,
  valueColor,
}: {
  label: string;
  value: string;
  bold?: boolean;
  mono?: boolean;
  small?: boolean;
  valueColor?: string;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>{label}</span>
      <span
        className={`${bold ? "font-semibold" : ""} ${mono ? "font-mono" : ""} ${small ? "text-xs" : "text-sm"} truncate max-w-[55%]`}
        style={{ color: valueColor ?? "var(--text-primary)" }}
      >
        {value}
      </span>
    </div>
  );
}
