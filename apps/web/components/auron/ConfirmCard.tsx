"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";

interface ConfirmCardProps {
  merchant: string;
  upiId: string;
  inrAmount: number;
  usdcAmount: number;
  fxRate: number;
  settlementPath?: string;
  fee?: string;
  estTime?: string;
  quoteExpiresIn?: number;
  onConfirm: () => void;
  onCancel: () => void;
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
};

const HOLD_DURATION = 1500;

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@300;400;500;600&display=swap');

  .confirm-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  .confirm-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.65);
    backdrop-filter: blur(3px);
  }

  .confirm-sheet {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 390px;
    background: ${C.s1};
    border-radius: 20px 20px 0 0;
    border-top: 0.5px solid ${C.borderB};
    overflow: hidden;
  }

  .confirm-sheet::after {
    content: '';
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 220px;
    background: radial-gradient(ellipse 80% 60% at 50% 100%, rgba(245,166,35,0.07) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }

  .confirm-sheet::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image: url("https://www.transparenttextures.com/patterns/stardust.png");
    opacity: 0.025;
    pointer-events: none;
    z-index: 0;
  }

  .sheet-inner {
    position: relative;
    z-index: 1;
    padding: 0 20px 36px;
  }

  .sheet-handle {
    width: 36px; height: 4px;
    border-radius: 999px;
    background: ${C.border};
    margin: 10px auto 20px;
  }

  .merchant-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
  }
  .merchant-avatar {
    width: 52px; height: 52px;
    border-radius: 50%;
    background: ${C.s2};
    border: 1px solid ${C.border};
    display: flex; align-items: center; justify-content: center;
    font-family: 'Instrument Serif', serif;
    font-size: 22px;
    color: ${C.muted};
  }

  .amount-display {
    text-align: center;
    margin-bottom: 20px;
  }
  .amount-inr {
    font-family: 'Instrument Serif', serif;
    font-size: 52px;
    font-weight: 400;
    color: ${C.gold};
    line-height: 1;
    letter-spacing: -0.02em;
  }
  .amount-usdc {
    font-family: 'Geist Mono', monospace;
    font-size: 13px;
    color: ${C.muted};
    margin-top: 8px;
  }

  .expiry-wrap { margin-bottom: 20px; }
  .expiry-track {
    height: 2px;
    background: ${C.border};
    border-radius: 999px;
    overflow: hidden;
    margin-bottom: 6px;
  }
  .expiry-fill {
    height: 100%;
    background: ${C.gold};
    border-radius: 999px;
    transform-origin: left;
    transition: transform 1s linear;
  }

  .details-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1px;
    background: ${C.border};
    border: 1px solid ${C.border};
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 24px;
  }
  .detail-cell {
    background: ${C.s2};
    padding: 12px 14px;
  }
  .detail-label {
    font-family: 'Geist Mono', monospace;
    font-size: 9px;
    color: ${C.dim};
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 5px;
  }
  .detail-value {
    font-family: 'Geist Mono', monospace;
    font-size: 14px;
    font-weight: 500;
    color: ${C.text};
  }
  .detail-value-lime { color: ${C.lime}; }

  .hold-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }
  .hold-button {
    position: relative;
    width: 76px; height: 76px;
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    touch-action: none;
  }
  .hold-svg {
    position: absolute;
    inset: 0;
    transform: rotate(-90deg);
  }
  .hold-track {
    fill: none;
    stroke: rgba(200,241,53,0.12);
    stroke-width: 2.5;
  }
  .hold-progress-circle {
    fill: none;
    stroke: ${C.lime};
    stroke-width: 2.5;
    stroke-linecap: round;
    transition: stroke-dashoffset 0.05s linear;
  }
  .hold-inner {
    position: absolute;
    inset: 8px;
    border-radius: 50%;
    background: ${C.s3};
    border: 1px solid ${C.border};
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.3s, border-color 0.3s;
  }
  .hold-inner-active {
    background: rgba(200,241,53,0.1);
    border-color: rgba(200,241,53,0.3);
  }
  .hold-inner-done {
    background: rgba(200,241,53,0.15);
    border-color: ${C.lime};
  }

  .cancel-link {
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
  .cancel-link:hover { color: ${C.muted}; }
`;

const RADIUS = 34;
const CIRC = 2 * Math.PI * RADIUS;

export default function ConfirmCard({
  merchant, upiId, inrAmount, usdcAmount, fxRate,
  settlementPath = "OnMeta A", fee = "0.5%", estTime = "~20s",
  quoteExpiresIn = 60, onConfirm, onCancel,
}: ConfirmCardProps) {
  const [holdProgress, setHoldProgress] = useState(0);
  const [holding, setHolding] = useState(false);
  const [done, setDone] = useState(false);
  const [timeLeft, setTimeLeft] = useState(quoteExpiresIn);

  const holdStart = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const t = setInterval(() => {
      setTimeLeft(n => {
        if (n <= 1) {
          // Quote expired — auto-dismiss after a brief pause so the user sees "0s"
          setTimeout(onCancel, 800);
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  // onCancel identity is stable (arrow in parent) — intentional single-run
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tick = useCallback(() => {
    if (!holdStart.current) return;
    const elapsed = Date.now() - holdStart.current;
    const progress = Math.min(elapsed / HOLD_DURATION, 1);
    setHoldProgress(progress);
    if (progress < 1) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      setDone(true);
      setTimeout(onConfirm, 300);
    }
  }, [onConfirm]);

  const startHold = useCallback(() => {
    if (done) return;
    setHolding(true);
    holdStart.current = Date.now();
    rafRef.current = requestAnimationFrame(tick);
    if (navigator.vibrate) navigator.vibrate(10);
  }, [done, tick]);

  const stopHold = useCallback(() => {
    if (done) return;
    setHolding(false);
    holdStart.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setHoldProgress(0);
  }, [done]);

  const expired = timeLeft === 0;
  const dashOffset = CIRC * (1 - holdProgress);
  const expiryScale = timeLeft / quoteExpiresIn;

  return (
    <>
      <style>{STYLES}</style>
      <div className="confirm-overlay">
        <div className="confirm-backdrop" onClick={onCancel} />
        <motion.div
          className="confirm-sheet"
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ duration: 0.38, ease: [0.32, 0.72, 0, 1] }}
        >
          <div className="sheet-inner">
            <div className="sheet-handle" />

            <div className="merchant-block">
              <div className="merchant-avatar">{merchant[0]}</div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 15, fontWeight: 600, color: C.text, margin: 0 }}>{merchant}</p>
                <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.dim, margin: "2px 0 0" }}>{upiId}</p>
              </div>
            </div>

            <div style={{ height: "0.5px", background: C.border, marginBottom: 20 }} />

            <div className="amount-display">
              <div className="amount-inr">₹{inrAmount.toLocaleString("en-IN")}</div>
              <div className="amount-usdc">
                You spend{" "}
                <span style={{ color: C.usdc }}>{usdcAmount} USDC</span>
              </div>
            </div>

            <div className="expiry-wrap">
              <div className="expiry-track">
                <div className="expiry-fill" style={{ transform: `scaleX(${expiryScale})` }} />
              </div>
              <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: expired ? "#EF4444" : C.dim, textAlign: "right", letterSpacing: "0.06em", transition: "color 0.3s" }}>
                {expired ? "Quote expired — dismissing…" : `Rate expires in ${timeLeft}s`}
              </p>
            </div>

            <div className="details-grid">
              <div className="detail-cell">
                <p className="detail-label">Rate</p>
                <p className="detail-value">₹{fxRate}</p>
              </div>
              <div className="detail-cell">
                <p className="detail-label">Path</p>
                <p className="detail-value detail-value-lime">{settlementPath}</p>
              </div>
              <div className="detail-cell">
                <p className="detail-label">Fee</p>
                <p className="detail-value">{fee}</p>
              </div>
              <div className="detail-cell">
                <p className="detail-label">Est. Time</p>
                <p className="detail-value">{estTime}</p>
              </div>
            </div>

            <div className="hold-container">
              <div
                className="hold-button"
                style={{ opacity: expired ? 0.35 : 1, pointerEvents: expired ? "none" : "auto", transition: "opacity 0.3s" }}
                onMouseDown={startHold}
                onMouseUp={stopHold}
                onMouseLeave={stopHold}
                onTouchStart={e => { e.preventDefault(); startHold(); }}
                onTouchEnd={stopHold}
                onTouchCancel={stopHold}
              >
                <svg className="hold-svg" viewBox="0 0 76 76">
                  <circle className="hold-track" cx="38" cy="38" r={RADIUS} />
                  <circle
                    className="hold-progress-circle"
                    cx="38" cy="38" r={RADIUS}
                    strokeDasharray={CIRC}
                    strokeDashoffset={dashOffset}
                  />
                </svg>
                <div className={`hold-inner${holding ? " hold-inner-active" : ""}${done ? " hold-inner-done" : ""}`}>
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

              <button className="cancel-link" onClick={onCancel}>Cancel</button>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}
