"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

// ─── Props ────────────────────────────────────────────────────────────────────
interface QRAmountScreenProps {
  merchantName: string;
  upiId:        string;
  fxRate:       number;
  prefillAmount?: number;   // from QR am= field
  onPay:  (inrAmount: number, usdcAmount: number) => void;
  onBack: () => void;
}

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:      "#08080A",
  s1:      "#0F0F12",
  s2:      "#161619",
  border:  "#26262A",
  borderB: "#3A3A3F",
  text:    "#F5F5F0",
  muted:   "#9A9AA8",
  dim:     "#606068",
  lime:    "#C8F135",
  gold:    "#F5A623",
  usdc:    "#2775CA",
  red:     "#EF4444",
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@300;400;500;600&display=swap');

  .qra-root {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: ${C.bg};
    font-family: 'Geist', sans-serif;
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
  }

  .qra-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    border-bottom: 0.5px solid ${C.border};
    flex-shrink: 0;
  }

  .qra-back {
    width: 34px; height: 34px;
    border-radius: 9px;
    background: ${C.s2};
    border: 1px solid ${C.border};
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: ${C.muted};
    transition: border-color 0.15s, color 0.15s;
    flex-shrink: 0;
  }
  .qra-back:hover { border-color: ${C.borderB}; color: ${C.text}; }

  .qra-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 32px 24px 24px;
    gap: 0;
    overflow-y: auto;
    max-width: 390px;
    margin: 0 auto;
    width: 100%;
  }

  .qra-merchant-card {
    width: 100%;
    background: ${C.s1};
    border: 1px solid ${C.border};
    border-radius: 16px;
    padding: 20px;
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 36px;
  }

  .qra-avatar {
    width: 48px; height: 48px;
    border-radius: 13px;
    background: linear-gradient(135deg, #1C1C20, #26262A);
    border: 1px solid ${C.border};
    display: flex; align-items: center; justify-content: center;
    font-size: 15px; font-weight: 700; color: ${C.muted};
    flex-shrink: 0;
  }

  .qra-amount-label {
    font-family: 'Geist Mono', monospace;
    font-size: 10px;
    color: ${C.dim};
    letter-spacing: 0.12em;
    margin-bottom: 12px;
    text-align: center;
  }

  .qra-input-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-bottom: 10px;
    width: 100%;
  }

  .qra-currency {
    font-family: 'Instrument Serif', serif;
    font-size: 42px;
    color: ${C.muted};
    line-height: 1;
    flex-shrink: 0;
    padding-top: 4px;
  }

  .qra-input {
    font-family: 'Instrument Serif', serif;
    font-size: 64px;
    color: ${C.text};
    background: transparent;
    border: none;
    outline: none;
    width: 100%;
    min-width: 0;
    text-align: left;
    caret-color: ${C.lime};
    line-height: 1;
  }
  .qra-input::placeholder { color: ${C.border}; }

  .qra-divider {
    width: 100%;
    height: 0.5px;
    background: ${C.border};
    margin: 4px 0 14px;
  }

  .qra-usdc-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-bottom: 40px;
  }

  .qra-pay-btn {
    width: 100%;
    padding: 17px;
    border-radius: 14px;
    background: ${C.lime};
    border: none;
    cursor: pointer;
    font-family: 'Geist Mono', monospace;
    font-size: 13px;
    font-weight: 600;
    color: #000;
    letter-spacing: 0.08em;
    transition: background 0.15s, transform 0.1s, opacity 0.15s;
    margin-top: auto;
  }
  .qra-pay-btn:hover:not(:disabled) { background: #A3C42A; }
  .qra-pay-btn:active:not(:disabled) { transform: scale(0.98); }
  .qra-pay-btn:disabled {
    background: ${C.s2};
    color: ${C.dim};
    cursor: not-allowed;
    border: 1px solid ${C.border};
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────
export default function QRAmountScreen({
  merchantName, upiId, fxRate, prefillAmount, onPay, onBack,
}: QRAmountScreenProps) {
  const [rawAmount, setRawAmount] = useState(
    prefillAmount && prefillAmount > 0 ? String(prefillAmount) : ""
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 250); }, []);

  const inrAmount  = parseFloat(rawAmount) || 0;
  const rate       = fxRate > 0 ? fxRate : 84;
  const usdcAmount = parseFloat((inrAmount / rate).toFixed(2));
  const canPay     = inrAmount >= 1;
  const initials   = (merchantName ?? "?").slice(0, 2).toUpperCase();

  function handleInput(val: string) {
    // Only allow digits and one decimal point, max 2 decimal places
    const clean = val.replace(/[^0-9.]/g, "");
    const parts  = clean.split(".");
    if (parts.length > 2) return;
    if (parts[1] && parts[1].length > 2) return;
    setRawAmount(clean);
  }

  function handlePay() {
    if (!canPay) return;
    onPay(inrAmount, usdcAmount);
  }

  return (
    <>
      <style>{STYLES}</style>
      <div className="qra-root">

        {/* Header */}
        <div className="qra-header">
          <button type="button" className="qra-back" onClick={onBack} aria-label="Back">
            <ArrowLeft size={16} />
          </button>
          <div>
            <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, letterSpacing: "0.12em", margin: 0 }}>
              ENTER AMOUNT
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="qra-body">

          {/* Merchant card */}
          <div className="qra-merchant-card">
            <div className="qra-avatar">{initials}</div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: C.text, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {merchantName}
              </p>
              <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.dim, margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {upiId}
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: C.lime, display: "inline-block" }} />
                <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 9, color: C.lime, letterSpacing: "0.08em" }}>UPI VERIFIED</span>
              </div>
            </div>
          </div>

          {/* Amount input */}
          <p className="qra-amount-label">AMOUNT TO PAY</p>

          <div className="qra-input-row">
            <span className="qra-currency">₹</span>
            <input
              ref={inputRef}
              className="qra-input"
              type="tel"
              inputMode="decimal"
              placeholder="0"
              value={rawAmount}
              onChange={e => handleInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && canPay) handlePay(); }}
              aria-label="Amount in INR"
            />
          </div>

          <div className="qra-divider" />

          {/* USDC equivalent */}
          <div className="qra-usdc-row">
            {inrAmount > 0 ? (
              <>
                <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 13, color: C.usdc }}>
                  {usdcAmount} USDC
                </span>
                <span style={{ fontSize: 12, color: C.dim }}>·</span>
                <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.dim }}>
                  ₹{rate.toFixed(2)}/USDC
                </span>
              </>
            ) : (
              <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 12, color: C.dim }}>
                Enter amount above
              </span>
            )}
          </div>

          {/* Pay button */}
          <motion.button
            type="button"
            className="qra-pay-btn"
            disabled={!canPay}
            onClick={handlePay}
            whileTap={canPay ? { scale: 0.97 } : {}}
          >
            {canPay
              ? `PAY ₹${inrAmount.toLocaleString("en-IN")} TO ${merchantName.toUpperCase()}`
              : "ENTER AMOUNT TO CONTINUE"}
          </motion.button>

          {/* Rate note */}
          {canPay && (
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, marginTop: 12, textAlign: "center" }}
            >
              Live rate · 0.85% spread included
            </motion.p>
          )}

        </div>
      </div>
    </>
  );
}
