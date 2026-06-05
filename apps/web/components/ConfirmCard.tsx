"use client";

import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import type { ParsedAction } from "@/lib/claude";
import type { SecurityFlag } from "@/lib/security";

// ─── Props expected by ChatInterface ─────────────────────────────────────────
interface ConfirmCardProps {
  confirmText: string;
  action: ParsedAction;
  securityFlags: SecurityFlag[];
  onConfirm: () => void;
  onCancel: () => void;
  isExecuting: boolean;
}

const C = {
  bg:      "#08080A",
  s1:      "#0F0F12",
  s2:      "#161619",
  s3:      "#1C1C20",
  border:  "#26262A",
  borderB: "#3A3A3F",
  text:    "#F5F5F0",
  muted:   "#9A9AA8",
  dim:     "#606068",
  lime:    "#C8F135",
  gold:    "#F5A623",
  usdc:    "#2775CA",
  error:   "#EF4444",
};

const HOLD_DURATION = 1500;
const RADIUS = 34;
const CIRC = 2 * Math.PI * RADIUS;

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@300;400;500;600&display=swap');

  .cc-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }
  .cc-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.65);
    backdrop-filter: blur(3px);
  }
  .cc-sheet {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 420px;
    background: ${C.s1};
    border-radius: 20px 20px 0 0;
    border-top: 0.5px solid ${C.borderB};
    overflow: hidden;
  }
  .cc-sheet::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 220px;
    background: radial-gradient(ellipse 80% 60% at 50% 100%, rgba(245,166,35,0.07) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }
  .cc-inner {
    position: relative;
    z-index: 1;
    padding: 0 20px 36px;
  }
  .cc-handle {
    width: 36px; height: 4px;
    border-radius: 999px;
    background: ${C.border};
    margin: 10px auto 20px;
  }
  .cc-merchant-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
  }
  .cc-avatar {
    width: 52px; height: 52px;
    border-radius: 50%;
    background: ${C.s2};
    border: 1px solid ${C.border};
    display: flex; align-items: center; justify-content: center;
    font-family: 'Instrument Serif', serif;
    font-size: 22px;
    color: ${C.muted};
  }
  .cc-amount-inr {
    font-family: 'Instrument Serif', serif;
    font-size: 52px;
    font-weight: 400;
    color: ${C.gold};
    line-height: 1;
    letter-spacing: -0.02em;
    text-align: center;
  }
  .cc-amount-usdc {
    font-family: 'Geist Mono', monospace;
    font-size: 13px;
    color: ${C.muted};
    margin-top: 8px;
    text-align: center;
  }
  .cc-details-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px;
    background: ${C.border};
    border: 1px solid ${C.border};
    border-radius: 10px;
    overflow: hidden;
    margin: 20px 0 24px;
  }
  .cc-detail-cell {
    background: ${C.s2};
    padding: 12px 14px;
  }
  .cc-detail-label {
    font-family: 'Geist Mono', monospace;
    font-size: 9px;
    color: ${C.dim};
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 5px;
  }
  .cc-detail-value {
    font-family: 'Geist Mono', monospace;
    font-size: 14px;
    font-weight: 500;
    color: ${C.text};
  }
  /* Generic action confirm text */
  .cc-confirm-text {
    font-family: 'Geist', sans-serif;
    font-size: 15px;
    color: ${C.text};
    text-align: center;
    margin-bottom: 24px;
    line-height: 1.5;
    padding: 0 8px;
  }
  /* Security flags */
  .cc-flag {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 8px;
    background: rgba(239,68,68,0.06);
    border: 1px solid rgba(239,68,68,0.18);
    margin-bottom: 12px;
  }
  /* Hold button */
  .cc-hold-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  .cc-hold-button {
    position: relative;
    width: 76px; height: 76px;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    touch-action: none;
  }
  .cc-hold-svg {
    position: absolute;
    inset: 0;
    transform: rotate(-90deg);
  }
  .cc-hold-track { fill: none; stroke: rgba(200,241,53,0.12); stroke-width: 2.5; }
  .cc-hold-progress { fill: none; stroke: ${C.lime}; stroke-width: 2.5; stroke-linecap: round; transition: stroke-dashoffset 0.05s linear; }
  .cc-hold-inner {
    position: absolute;
    inset: 8px;
    border-radius: 50%;
    background: ${C.s3};
    border: 1px solid ${C.border};
    display: flex; align-items: center; justify-content: center;
    transition: background 0.3s, border-color 0.3s;
  }
  .cc-hold-inner-active { background: rgba(200,241,53,0.1); border-color: rgba(200,241,53,0.3); }
  .cc-hold-inner-done   { background: rgba(200,241,53,0.15); border-color: ${C.lime}; }
  /* Executing spinner */
  .cc-executing-btn {
    width: 100%;
    padding: 15px;
    border-radius: 12px;
    background: ${C.s2};
    border: 1px solid ${C.border};
    color: ${C.muted};
    font-family: 'Geist Mono', monospace;
    font-size: 12px;
    letter-spacing: 0.08em;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }
  @keyframes ccSpin { to { transform: rotate(360deg); } }
  .cc-spinner {
    width: 14px; height: 14px;
    border: 2px solid ${C.border};
    border-top-color: ${C.lime};
    border-radius: 50%;
    animation: ccSpin 0.8s linear infinite;
  }
  .cc-cancel-link {
    font-family: 'Geist Mono', monospace;
    font-size: 11px;
    color: ${C.dim};
    background: none;
    border: none;
    cursor: pointer;
    letter-spacing: 0.06em;
    margin-top: 4px;
    transition: color 0.15s;
  }
  .cc-cancel-link:hover { color: ${C.muted}; }
`;

export default function ConfirmCard({
  confirmText,
  action,
  securityFlags,
  onConfirm,
  onCancel,
  isExecuting,
}: ConfirmCardProps) {
  const isUPI = action.action === "upi_payment";

  const [holdProgress, setHoldProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const [done, setDone] = useState(false);

  const holdStart = useRef<number | null>(null);
  const rafRef    = useRef<number | null>(null);

  const tick = useCallback(() => {
    if (!holdStart.current) return;
    const progress = Math.min((Date.now() - holdStart.current) / HOLD_DURATION, 1);
    setHoldProgress(progress);
    if (progress < 1) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      setDone(true);
      setTimeout(onConfirm, 300);
    }
  }, [onConfirm]);

  const startHold = useCallback(() => {
    if (done || isExecuting) return;
    setHolding(true);
    holdStart.current = Date.now();
    rafRef.current = requestAnimationFrame(tick);
    if (navigator.vibrate) navigator.vibrate(10);
  }, [done, isExecuting, tick]);

  const stopHold = useCallback(() => {
    if (done) return;
    setHolding(false);
    holdStart.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setHoldProgress(0);
  }, [done]);

  // Non-UPI: simple button confirm
  function handleSimpleConfirm() {
    if (isExecuting || done) return;
    setDone(true);
    onConfirm();
  }

  const dashOffset = CIRC * (1 - holdProgress);

  // ── Derive display values ─────────────────────────────────────────────────
  const merchant  = action.merchant_name ?? action.recipient ?? "Merchant";
  const upiId     = action.upi_id ?? "";
  const inrAmount = action.inr_amount ?? action.amount ?? 0;
  const usdcAmt   = action.amount_usdc ?? 0;

  return (
    <>
      <style>{STYLES}</style>
      <div className="cc-overlay">
        <div className="cc-backdrop" onClick={isExecuting ? undefined : onCancel} />
        <motion.div
          className="cc-sheet"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ duration: 0.38, ease: [0.32, 0.72, 0, 1] }}
        >
          <div className="cc-inner">
            <div className="cc-handle" />

            {/* ── UPI payment — full auron design ── */}
            {isUPI ? (
              <>
                <div className="cc-merchant-block">
                  <div className="cc-avatar">{merchant[0]?.toUpperCase()}</div>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 15, fontWeight: 600, color: C.text, margin: 0 }}>{merchant}</p>
                    {upiId && <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.dim, margin: "2px 0 0" }}>{upiId}</p>}
                  </div>
                </div>

                <div style={{ height: "0.5px", background: C.border, marginBottom: 20 }} />

                <div className="cc-amount-inr">₹{inrAmount.toLocaleString("en-IN")}</div>
                <div className="cc-amount-usdc">
                  You spend <span style={{ color: C.usdc }}>{usdcAmt.toFixed(4)} USDC</span>
                </div>

                <div className="cc-details-grid">
                  <div className="cc-detail-cell">
                    <p className="cc-detail-label">Settlement</p>
                    <p className="cc-detail-value" style={{ color: C.lime }}>OnMeta A</p>
                  </div>
                  <div className="cc-detail-cell">
                    <p className="cc-detail-label">Est. Time</p>
                    <p className="cc-detail-value">~20s</p>
                  </div>
                  <div className="cc-detail-cell">
                    <p className="cc-detail-label">Fee</p>
                    <p className="cc-detail-value">0.5%</p>
                  </div>
                  <div className="cc-detail-cell">
                    <p className="cc-detail-label">Network</p>
                    <p className="cc-detail-value">Solana</p>
                  </div>
                </div>
              </>
            ) : (
              /* ── Other actions — text confirmation ── */
              <>
                <div style={{ textAlign: "center", marginBottom: 16 }}>
                  <div style={{ width: 52, height: 52, borderRadius: "50%", background: C.s2, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                  </div>
                  <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, letterSpacing: "0.1em", marginBottom: 6 }}>CONFIRM ACTION</p>
                </div>
                <p className="cc-confirm-text">{confirmText}</p>
              </>
            )}

            {/* Security flags */}
            {securityFlags.map((flag, i) => (
              <div key={i} className="cc-flag">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={C.error} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: "rgba(239,68,68,0.8)" }}>
                  {flag.type.replace(/_/g, " ")}
                </span>
              </div>
            ))}

            {/* Hold to confirm / executing */}
            {isExecuting ? (
              <div className="cc-executing-btn">
                <div className="cc-spinner" />
                PROCESSING…
              </div>
            ) : isUPI ? (
              <div className="cc-hold-container">
                <div
                  className="cc-hold-button"
                  onMouseDown={startHold}
                  onMouseUp={stopHold}
                  onMouseLeave={stopHold}
                  onTouchStart={e => { e.preventDefault(); startHold(); }}
                  onTouchEnd={stopHold}
                  onTouchCancel={stopHold}
                >
                  <svg className="cc-hold-svg" viewBox="0 0 76 76">
                    <circle className="cc-hold-track" cx="38" cy="38" r={RADIUS} />
                    <circle className="cc-hold-progress" cx="38" cy="38" r={RADIUS} strokeDasharray={CIRC} strokeDashoffset={dashOffset} />
                  </svg>
                  <div className={`cc-hold-inner${holding ? " cc-hold-inner-active" : ""}${done ? " cc-hold-inner-done" : ""}`}>
                    {done ? (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.lime} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </motion.div>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={holding ? C.lime : C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "stroke 0.2s" }}>
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    )}
                  </div>
                </div>
                <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  {done ? "Confirmed" : holding ? "Hold..." : "Hold to Pay"}
                </p>
                <button className="cc-cancel-link" onClick={onCancel}>Cancel</button>
              </div>
            ) : (
              /* Generic confirm button for non-UPI actions */
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <button
                  onClick={handleSimpleConfirm}
                  style={{
                    width: "100%", padding: 15, borderRadius: 12,
                    background: C.lime, border: "none",
                    fontFamily: "'Geist',sans-serif", fontSize: 14, fontWeight: 700, color: "#0A0A08",
                    cursor: "pointer", transition: "background 0.15s",
                  }}
                >
                  Confirm
                </button>
                <button className="cc-cancel-link" style={{ textAlign: "center" }} onClick={onCancel}>Cancel</button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </>
  );
}
