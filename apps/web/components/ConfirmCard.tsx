"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ShieldAlert, Clock, ArrowRight, Check, Shield, ChevronLeft } from "lucide-react";
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

const ACTION_META: Record<string, { icon: string; label: string; accent: string }> = {
  transfer:        { icon: "💸", label: "Transfer",         accent: "#3B82F6" },
  transfer_sol:    { icon: "◎",  label: "Send SOL",         accent: "#3B82F6" },
  transfer_usdc:   { icon: "💵", label: "Send USDC",        accent: "#3B82F6" },
  upi_payment:     { icon: "🇮🇳", label: "UPI Payment",    accent: "#22C55E" },
  stamp_agreement: { icon: "🤝", label: "Record Agreement", accent: "#7C3AED" },
  lock_savings:    { icon: "🔒", label: "Lock Savings",     accent: "#7C3AED" },
  stamp_ownership: { icon: "📎", label: "Prove Ownership",  accent: "#F59E0B" },
};

export default function ConfirmCard({
  confirmText, action, securityFlags, onConfirm, onCancel, isExecuting,
}: ConfirmCardProps) {
  const [cooldown, setCooldown]       = useState(0);
  const [holdProgress, setHoldProgress] = useState(0);
  const [rateSecs, setRateSecs]       = useState(60);
  const holdRef   = useRef<NodeJS.Timeout | null>(null);
  const holdStart = useRef<number>(0);
  const progressBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    progressBarRef.current?.style.setProperty("--hold-progress", `${holdProgress * 100}%`);
  }, [holdProgress]);

  // Rate locked countdown
  useEffect(() => {
    const iv = setInterval(() => setRateSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(iv);
  }, []);

  const urgencyFlag = securityFlags.find(f => f.type === "URGENCY_DETECTED");
  const aboveFlag   = securityFlags.find(f => f.type === "ABOVE_CEILING" || f.type === "EXTREME_AMOUNT");
  const needsHold   = !!aboveFlag;
  const holdMs      = aboveFlag && "holdDurationMs" in aboveFlag ? aboveFlag.holdDurationMs : 0;

  useEffect(() => {
    if (!urgencyFlag) return;
    setCooldown(60);
    const iv = setInterval(() => setCooldown(c => { if (c <= 1) { clearInterval(iv); return 0; } return c - 1; }), 1000);
    return () => clearInterval(iv);
  }, [urgencyFlag]);

  const buttonBlocked = cooldown > 0 || isExecuting;

  const startHold = () => {
    if (buttonBlocked) return;
    holdStart.current = Date.now();
    const tick = () => {
      const progress = Math.min((Date.now() - holdStart.current) / holdMs, 1);
      setHoldProgress(progress);
      if (progress < 1) holdRef.current = setTimeout(tick, 16);
      else onConfirm();
    };
    holdRef.current = setTimeout(tick, 16);
  };
  const cancelHold = () => {
    if (holdRef.current) clearTimeout(holdRef.current);
    setHoldProgress(0);
  };

  const meta   = ACTION_META[action.action ?? "transfer"] ?? ACTION_META.transfer;
  const isUPI  = action.action === "upi_payment";

  // Merchant display
  const merchantName = action.merchant_name ?? action.upi_id?.split("@")[0] ?? "Merchant";
  const merchantInitials = merchantName.slice(0, 2).toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)" }}
      onClick={e => e.target === e.currentTarget && !isExecuting && onCancel()}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 420,
          borderRadius: "24px 24px 0 0",
          background: "#07090D",
          border: "1px solid rgba(148,163,184,0.1)",
          borderBottom: "none",
          boxShadow: "0 -24px 80px rgba(0,0,0,0.6)",
          overflow: "hidden",
        }}
        className="sm:rounded-3xl sm:border-b"
      >
        {/* Drag handle */}
        <div className="sm:hidden flex justify-center pt-3 pb-1">
          <div style={{ width: 36, height: 4, borderRadius: 999, background: "rgba(148,163,184,0.2)" }} />
        </div>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 12px", borderBottom: "1px solid rgba(148,163,184,0.07)" }}>
          <button onClick={onCancel} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13 }}>
            <ChevronLeft size={16} /> Back
          </button>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Payment Summary</span>
          <div style={{ width: 48 }} />
        </div>

        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Security alerts */}
          <AnimatePresence>
            {urgencyFlag && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", display: "flex", gap: 10 }}>
                <ShieldAlert size={15} color="#F87171" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#F87171", margin: "0 0 2px" }}>Urgency language detected</p>
                  <p style={{ fontSize: 11, color: "rgba(248,113,113,0.7)", margin: 0 }}>
                    Scammers create false urgency.{cooldown > 0 && <strong> Wait {cooldown}s.</strong>}
                  </p>
                </div>
              </motion.div>
            )}
            {aboveFlag && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                style={{ padding: "12px 14px", borderRadius: 12, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", display: "flex", gap: 10 }}>
                <AlertTriangle size={15} color="#FCD34D" style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#FCD34D", margin: "0 0 2px" }}>
                    {aboveFlag.type === "EXTREME_AMOUNT" ? "Unusually large amount" : "Above your spend ceiling"}
                  </p>
                  <p style={{ fontSize: 11, color: "rgba(252,211,77,0.7)", margin: 0 }}>Hold the confirm button to proceed.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Merchant card */}
          <div style={{ padding: "16px", borderRadius: 16, background: "rgba(15,23,42,0.7)", border: "1px solid rgba(148,163,184,0.08)", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: `${meta.accent}20`, border: `1px solid ${meta.accent}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: meta.accent, flexShrink: 0 }}>
              {isUPI ? merchantInitials : meta.icon}
            </div>
            <div>
              <p style={{ fontSize: 10, color: "var(--text-muted)", margin: "0 0 3px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Merchant</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: "0 0 2px", letterSpacing: "-0.01em" }}>{merchantName}</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>{meta.label}</p>
            </div>
          </div>

          {/* Amount rows */}
          <div style={{ borderRadius: 16, background: "rgba(15,23,42,0.7)", border: "1px solid rgba(148,163,184,0.08)", overflow: "hidden" }}>
            {isUPI ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
                  <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>Amount</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", fontFamily: "monospace" }}>₹{action.inr_amount?.toLocaleString("en-IN") ?? "—"}</span>
                </div>
                <div style={{ padding: "14px 18px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>You Pay</span>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", margin: 0, letterSpacing: "-0.02em", fontFamily: "monospace" }}>
                        {action.amount_usdc?.toFixed(2) ?? "—"} USDC
                      </p>
                      <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>
                        ≈ ₹{action.inr_amount?.toLocaleString("en-IN") ?? "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div style={{ padding: "14px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>Amount</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", fontFamily: "monospace" }}>
                    {action.amount_usdc != null ? `${action.amount_usdc.toFixed(4)} USDC` : action.amount != null ? `${action.amount}` : "—"}
                  </span>
                </div>
                {action.recipient && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(148,163,184,0.06)" }}>
                    <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>To</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "monospace" }}>
                      {action.recipient.length > 16 ? `${action.recipient.slice(0, 6)}…${action.recipient.slice(-4)}` : action.recipient}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Detail rows */}
          <div style={{ borderRadius: 16, background: "rgba(15,23,42,0.7)", border: "1px solid rgba(148,163,184,0.08)", overflow: "hidden" }}>
            {[
              { label: "Network", value: "Solana", badge: true },
              { label: "Settlement", value: isUPI ? "Instant UPI" : "On-chain" },
              { label: "Estimated Time", value: isUPI ? "~ 10–30 sec" : "~ 400ms" },
            ].map(({ label, value, badge }, i) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 18px", borderBottom: i < 2 ? "1px solid rgba(148,163,184,0.06)" : "none" }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{label}</span>
                {badge ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#9945FF" }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{value}</span>
                  </div>
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{value}</span>
                )}
              </div>
            ))}
            {/* Rate locked countdown */}
            {isUPI && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 18px", borderTop: "1px solid rgba(148,163,184,0.06)" }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Rate Locked</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: rateSecs < 15 ? "#EF4444" : "#3B82F6", fontFamily: "monospace", letterSpacing: "0.04em" }}>
                  {String(Math.floor(rateSecs / 60)).padStart(2, "0")}:{String(rateSecs % 60).padStart(2, "0")}
                </span>
              </div>
            )}
          </div>

          {/* Cooldown */}
          {cooldown > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Clock size={12} color="var(--text-muted)" />
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Confirm in <strong style={{ color: "#F59E0B" }}>{cooldown}s</strong></span>
            </div>
          )}

          {/* Security badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 12, background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
            <Shield size={15} color="#60A5FA" />
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Auron protects you</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>Your payment is secure and encrypted end-to-end.</p>
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onCancel} disabled={isExecuting}
              style={{ flex: 1, padding: "13px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(148,163,184,0.15)", fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer" }}>
              Cancel
            </button>

            {needsHold ? (
              <button
                onMouseDown={startHold} onMouseUp={cancelHold} onMouseLeave={cancelHold}
                onTouchStart={startHold} onTouchEnd={cancelHold}
                disabled={buttonBlocked}
                style={{ flex: 2, padding: "13px", borderRadius: 12, position: "relative", overflow: "hidden", background: buttonBlocked ? "rgba(59,130,246,0.3)" : "#3B82F6", border: "none", fontSize: 14, fontWeight: 700, color: "#fff", cursor: buttonBlocked ? "not-allowed" : "pointer", boxShadow: buttonBlocked ? "none" : "0 4px 16px rgba(59,130,246,0.35)" }}
              >
                <div ref={progressBarRef} style={{ position: "absolute", left: 0, top: 0, height: "100%", background: "rgba(255,255,255,0.2)", width: `${holdProgress * 100}%`, transition: "none" }} />
                <span style={{ position: "relative" }}>Hold to confirm {holdProgress > 0 ? `${Math.round(holdProgress * 100)}%` : ""}</span>
              </button>
            ) : (
              <motion.button
                onClick={!buttonBlocked ? onConfirm : undefined}
                disabled={buttonBlocked}
                whileHover={!buttonBlocked ? { scale: 1.02 } : {}}
                whileTap={!buttonBlocked ? { scale: 0.98 } : {}}
                style={{ flex: 2, padding: "13px", borderRadius: 12, background: buttonBlocked ? "rgba(59,130,246,0.3)" : "#3B82F6", border: "none", fontSize: 14, fontWeight: 700, color: "#fff", cursor: buttonBlocked ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: buttonBlocked ? "none" : "0 4px 20px rgba(59,130,246,0.4)" }}
              >
                {isExecuting ? (
                  <><div style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", animation: "spin 0.8s linear infinite" }} />Processing…</>
                ) : cooldown > 0 ? `Wait ${cooldown}s` : (
                  <>Confirm Payment <ArrowRight size={15} /></>
                )}
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
