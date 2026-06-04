"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ParsedIntent {
  merchant: string;
  upiId: string;
  inrAmount: number;
  usdcAmount: number;
  fxRate: number;
  settlementPath: string;
  confidence: number;
}

interface PaymentIntentScreenProps {
  onConfirm: (intent: ParsedIntent) => void;
  onBack: () => void;
  fxRate?: number;
}

// ─── Tokens ───────────────────────────────────────────────────────────────────
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
};

const SUGGESTIONS = [
  "Pay ₹450 to Swiggy",
  "Send ₹1000 to Priya",
  "Pay rent ₹15000",
  "Split coffee ₹340",
];

function simulateParseIntent(msg: string, fxRate: number): ParsedIntent | null {
  const amountMatch = msg.match(/₹?\s*(\d+(?:,\d+)?(?:\.\d+)?)/);
  if (!amountMatch) return null;
  const inr = parseFloat(amountMatch[1].replace(",", ""));
  const merchants: Record<string, string> = {
    swiggy: "swiggy@hdfcbank",
    zomato: "zomato@paytm",
    amazon: "amazon@axis",
    priya:  "priya@okaxis",
    rent:   "landlord@sbi",
    coffee: "bluetokai@icici",
  };
  const lower = msg.toLowerCase();
  let merchant = "Merchant", upiId = "merchant@upi";
  for (const [key, upi] of Object.entries(merchants)) {
    if (lower.includes(key)) {
      merchant = key.charAt(0).toUpperCase() + key.slice(1);
      upiId = upi;
      break;
    }
  }
  return {
    merchant,
    upiId,
    inrAmount: inr,
    usdcAmount: parseFloat((inr / fxRate).toFixed(2)),
    fxRate,
    settlementPath: "OnMeta A",
    confidence: 0.94,
  };
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@300;400;500;600&display=swap');

  .intent-screen {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: ${C.bg};
    font-family: 'Geist', sans-serif;
    -webkit-font-smoothing: antialiased;
    position: relative;
    overflow: hidden;
  }

  .intent-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 20px 20px 0;
    display: flex;
    flex-direction: column;
    gap: 20px;
    position: relative;
    z-index: 1;
  }

  .intent-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 28px;
    padding: 40px 20px;
  }

  .empty-headline {
    font-family: 'Instrument Serif', serif;
    font-size: 24px;
    font-weight: 400;
    color: ${C.borderB};
    text-align: center;
    line-height: 1.3;
  }

  .suggestion-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
  }

  .suggestion-pill {
    padding: 8px 14px;
    border: 1px solid ${C.border};
    border-radius: 100px;
    background: ${C.s1};
    font-family: 'Geist Mono', monospace;
    font-size: 11px;
    color: ${C.muted};
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
    white-space: nowrap;
  }
  .suggestion-pill:hover {
    border-color: ${C.borderB};
    color: ${C.text};
  }
  .suggestion-pill:active { transform: scale(0.97); }

  .intent-card {
    background: ${C.s1};
    border: 1px solid ${C.border};
    border-radius: 14px;
    padding: 20px;
    position: relative;
    overflow: hidden;
  }

  .confidence-bar {
    position: absolute;
    top: 0; left: 0;
    height: 2px;
    background: ${C.lime};
    border-radius: 2px 0 0 0;
    transition: width 0.6s ease-out;
  }

  .intent-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 0;
    border-bottom: 0.5px solid ${C.border};
  }
  .intent-row:last-of-type { border-bottom: none; }

  .intent-label {
    font-family: 'Geist Mono', monospace;
    font-size: 10px;
    color: ${C.dim};
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .confirm-btn {
    width: 100%;
    margin-top: 16px;
    padding: 14px;
    border-radius: 10px;
    background: ${C.lime};
    border: none;
    font-family: 'Geist', sans-serif;
    font-size: 15px;
    font-weight: 700;
    color: #0A0A08;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: background 0.15s, transform 0.1s;
  }
  .confirm-btn:hover { background: #A3C42A; }
  .confirm-btn:active { transform: scale(0.99); }

  .input-bar {
    padding: 12px 16px 20px;
    background: ${C.s1};
    border-top: 0.5px solid ${C.border};
    position: relative;
    z-index: 2;
    flex-shrink: 0;
  }
  .input-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
    background: ${C.s2};
    border: 1px solid ${C.border};
    border-radius: 12px;
    padding: 0 4px 0 14px;
    transition: border-color 0.2s;
  }
  .input-wrap:focus-within { border-color: ${C.borderB}; }

  .chat-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    font-family: 'Geist', sans-serif;
    font-size: 14px;
    color: ${C.text};
    padding: 12px 0;
    caret-color: ${C.lime};
  }
  .chat-input::placeholder { color: ${C.dim}; }

  .send-btn {
    width: 34px; height: 34px;
    border-radius: 8px;
    background: ${C.lime};
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: background 0.15s, transform 0.1s;
  }
  .send-btn:hover { background: #A3C42A; }
  .send-btn:active { transform: scale(0.93); }
  .send-btn:disabled {
    background: ${C.border};
    cursor: default;
  }

  .loading-dots {
    display: flex;
    gap: 5px;
    align-items: center;
    padding: 12px 0;
  }
  .loading-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: ${C.dim};
    animation: dotBounce 1.2s ease-in-out infinite;
  }
  .loading-dot:nth-child(2) { animation-delay: 0.2s; }
  .loading-dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes dotBounce {
    0%,80%,100% { transform: translateY(0); opacity: 0.4; }
    40% { transform: translateY(-6px); opacity: 1; }
  }

  .intent-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px 10px;
    flex-shrink: 0;
    position: relative;
    z-index: 2;
  }
`;

export default function PaymentIntentScreen({
  onConfirm,
  onBack,
  fxRate = 83.18,
}: PaymentIntentScreenProps) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<ParsedIntent | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  async function handleSubmit(msg?: string) {
    const text = msg ?? input.trim();
    if (!text) return;
    setInput("");
    setParsed(null);
    setLoading(true);
    await new Promise(r => setTimeout(r, 900));
    const result = simulateParseIntent(text, fxRate);
    setLoading(false);
    if (result) setParsed(result);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSubmit();
  }

  return (
    <>
      <style>{STYLES}</style>
      <div className="intent-screen">

        <div className="intent-topbar">
          <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: C.muted, fontSize: 13 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            Back
          </button>
          <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.dim, letterSpacing: "0.1em" }}>
            NEW PAYMENT
          </span>
          <div style={{ width: 48 }} />
        </div>

        <div className="intent-content">

          {!parsed && !loading && (
            <motion.div className="intent-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
              <p className="empty-headline">What are you<br />paying for?</p>
              <div className="suggestion-pills">
                {SUGGESTIONS.map(s => (
                  <button key={s} className="suggestion-pill" onClick={() => handleSubmit(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ padding: "12px 4px" }}>
              <div className="loading-dots">
                <div className="loading-dot" />
                <div className="loading-dot" />
                <div className="loading-dot" />
              </div>
            </motion.div>
          )}

          <AnimatePresence>
            {parsed && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                className="intent-card"
              >
                <div
                  className="confidence-bar"
                  style={{ width: `${parsed.confidence * 100}%` }}
                />

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingTop: 6 }}>
                  <div>
                    <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, letterSpacing: "0.1em", marginBottom: 4 }}>RECIPIENT</p>
                    <p style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>{parsed.merchant}</p>
                    <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.dim, margin: "2px 0 0" }}>{parsed.upiId}</p>
                  </div>
                  <div style={{
                    width: 44, height: 44,
                    borderRadius: 10,
                    background: C.s2,
                    border: `1px solid ${C.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, fontWeight: 700, color: C.muted,
                  }}>
                    {parsed.merchant[0]}
                  </div>
                </div>

                <div className="intent-row">
                  <span className="intent-label">Amount</span>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 22, fontWeight: 500, color: C.gold, margin: 0, letterSpacing: "-0.02em" }}>
                      ₹{parsed.inrAmount.toLocaleString("en-IN")}
                    </p>
                    <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 12, color: C.usdc, margin: "2px 0 0" }}>
                      {parsed.usdcAmount} USDC
                    </p>
                  </div>
                </div>

                <div className="intent-row">
                  <span className="intent-label">Rate</span>
                  <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 13, color: C.muted }}>
                    ₹{parsed.fxRate} / USDC
                  </span>
                </div>

                <div className="intent-row">
                  <span className="intent-label">Settlement</span>
                  <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 12, color: C.lime }}>
                    {parsed.settlementPath} · ~20s
                  </span>
                </div>

                <button className="confirm-btn" onClick={() => onConfirm(parsed)}>
                  Review & Confirm
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="input-bar">
          <div className="input-wrap">
            <input
              ref={inputRef}
              className="chat-input"
              placeholder="Pay ₹450 to Swiggy..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
            />
            <button
              className="send-btn"
              onClick={() => handleSubmit()}
              disabled={!input.trim() || loading}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0A0A08" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/>
              </svg>
            </button>
          </div>
        </div>

      </div>
    </>
  );
}
