"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Delete } from "lucide-react";
import { useLiveRate } from "@/lib/useLiveRate";

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
};

interface QRAmountEntryProps {
  merchantName: string;
  upiId: string;
  onConfirm: (inrAmount: number) => void;
  onCancel: () => void;
}

const PAD_KEYS = ["1","2","3","4","5","6","7","8","9",".","0","⌫"];

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');

  .qae-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: rgba(0,0,0,0.78);
    backdrop-filter: blur(8px);
  }

  .qae-sheet {
    width: 100%;
    max-width: 390px;
    background: ${C.s1};
    border-radius: 20px 20px 0 0;
    border-top: 0.5px solid ${C.border};
    overflow: hidden;
    font-family: 'Geist', sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .qae-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px;
    border-bottom: 0.5px solid ${C.border};
  }

  .qae-avatar {
    width: 42px; height: 42px;
    border-radius: 10px;
    background: rgba(200,241,53,0.06);
    border: 1px solid rgba(200,241,53,0.15);
    display: flex; align-items: center; justify-content: center;
    font-family: 'Instrument Serif', serif;
    font-size: 18px;
    color: ${C.lime};
    flex-shrink: 0;
  }

  .qae-close {
    width: 30px; height: 30px;
    border-radius: 8px;
    background: ${C.s2};
    border: 1px solid ${C.border};
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    color: ${C.dim};
    transition: border-color 0.15s;
  }
  .qae-close:hover { border-color: ${C.borderB}; }

  .qae-amount-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 28px 20px 20px;
  }

  .qae-currency {
    font-family: 'Instrument Serif', serif;
    font-size: 36px;
    color: ${C.border};
    line-height: 1;
    margin-right: 6px;
  }

  .qae-amount {
    font-family: 'Instrument Serif', serif;
    line-height: 1;
    letter-spacing: -0.03em;
    transition: font-size 0.1s ease;
  }

  .qae-usdc {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
    padding: 5px 12px;
    border-radius: 100px;
    background: rgba(200,241,53,0.06);
    border: 1px solid rgba(200,241,53,0.12);
  }

  .qae-pad {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1px;
    background: ${C.border};
    border-top: 1px solid ${C.border};
  }

  .qae-key {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 62px;
    background: ${C.s1};
    border: none;
    cursor: pointer;
    font-family: 'Geist', sans-serif;
    font-size: 22px;
    font-weight: 400;
    color: ${C.text};
    transition: background 0.1s;
  }
  .qae-key:hover { background: ${C.s2}; }
  .qae-key:active { background: ${C.border}; }
  .qae-key-delete { color: ${C.muted}; }

  .qae-confirm-wrap {
    padding: 12px 16px 24px;
  }

  .qae-confirm-btn {
    width: 100%;
    padding: 15px;
    border-radius: 12px;
    border: none;
    font-family: 'Geist', sans-serif;
    font-size: 15px;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    transition: background 0.15s, transform 0.1s;
  }
  .qae-confirm-active {
    background: ${C.lime};
    color: #0A0A08;
  }
  .qae-confirm-active:hover { background: #A3C42A; }
  .qae-confirm-active:active { transform: scale(0.99); }
  .qae-confirm-inactive {
    background: ${C.s2};
    border: 1px solid ${C.border};
    color: ${C.dim};
    cursor: not-allowed;
  }
`;

export default function QRAmountEntry({ merchantName, upiId, onConfirm, onCancel }: QRAmountEntryProps) {
  const [display, setDisplay] = useState("");
  const [shaking, setShaking] = useState(false);
  const { auronRate } = useLiveRate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const inrAmount = parseFloat(display) || 0;
  const usdcAmount = inrAmount > 0 ? (inrAmount / auronRate).toFixed(4) : null;

  const merchant = merchantName || upiId.split("@")[0];

  function pressKey(key: string) {
    if (key === "⌫") { setDisplay(prev => prev.slice(0, -1)); return; }
    if (key === "." && display.includes(".")) return;
    if (display.includes(".")) {
      const decimals = display.split(".")[1] ?? "";
      if (decimals.length >= 2) return;
    }
    const next = display + key;
    if (parseFloat(next) > 200_000) {
      setShaking(true);
      setTimeout(() => setShaking(false), 400);
      return;
    }
    if (display === "" && key === "0") return;
    setDisplay(next);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key >= "0" && e.key <= "9") pressKey(e.key);
    else if (e.key === ".") pressKey(".");
    else if (e.key === "Backspace") pressKey("⌫");
    else if (e.key === "Enter" && inrAmount >= 1) handleConfirm();
    else if (e.key === "Escape") onCancel();
  }

  function handleConfirm() {
    if (inrAmount < 1) {
      setShaking(true);
      setTimeout(() => setShaking(false), 400);
      return;
    }
    onConfirm(inrAmount);
  }

  const amountFontSize = display.length > 8 ? "clamp(2.5rem, 10vw, 3.5rem)" : "clamp(3rem, 13vw, 4.5rem)";

  return (
    <>
      <style>{STYLES}</style>
      <AnimatePresence>
        <motion.div
          className="qae-overlay"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
        >
          <motion.div
            className="qae-sheet"
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            onKeyDown={handleKeyDown}
            tabIndex={-1}
          >
            <input ref={inputRef} className="sr-only" onKeyDown={handleKeyDown} readOnly />

            <div className="qae-header">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div className="qae-avatar">{merchant.charAt(0).toUpperCase()}</div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: C.text, margin: 0 }}>{merchant}</p>
                  <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, margin: "2px 0 0" }}>{upiId}</p>
                </div>
              </div>
              <button className="qae-close" onClick={onCancel}><X size={14} /></button>
            </div>

            <motion.div
              className="qae-amount-wrap"
              animate={shaking ? { x: [-6, 6, -6, 6, 0] } : { x: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div style={{ display: "flex", alignItems: "baseline", minHeight: 72 }}>
                <span className="qae-currency">₹</span>
                <span className="qae-amount" style={{ fontSize: amountFontSize, color: display ? C.text : C.border }}>
                  {display || "0"}
                </span>
              </div>

              <AnimatePresence>
                {usdcAmount && (
                  <motion.div className="qae-usdc" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}>
                    <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 12, color: C.lime, fontWeight: 500 }}>
                      ~{usdcAmount} USDC
                    </span>
                    <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim }}>· &lt;$0.001 fee</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <div className="qae-pad">
              {PAD_KEYS.map((key) => (
                <motion.button
                  key={key}
                  className={`qae-key ${key === "⌫" ? "qae-key-delete" : ""}`}
                  onClick={() => pressKey(key)}
                  whileTap={{ scale: 0.93 }}
                >
                  {key === "⌫" ? <Delete size={19} /> : key}
                </motion.button>
              ))}
            </div>

            <div className="qae-confirm-wrap">
              <button
                className={`qae-confirm-btn ${inrAmount >= 1 ? "qae-confirm-active" : "qae-confirm-inactive"}`}
                onClick={handleConfirm}
              >
                {inrAmount >= 1 ? (
                  <>
                    Pay ₹{inrAmount.toLocaleString("en-IN")}
                    <ArrowRight size={16} />
                  </>
                ) : "Enter amount"}
              </button>
            </div>

          </motion.div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
