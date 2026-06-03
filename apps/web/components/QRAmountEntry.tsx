"use client";

/**
 * QRAmountEntry — Amount entry modal for static UPI QRs
 *
 * Appears when a UPI QR is scanned but has no amount embedded.
 * Skips Claude entirely — data is already structured from the QR.
 * User enters ₹ amount → directly to ConfirmCard.
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, ArrowRight, Delete } from "lucide-react";
import { useLiveRate } from "@/lib/useLiveRate";

interface QRAmountEntryProps {
  merchantName: string;
  upiId:        string;
  onConfirm:    (inrAmount: number) => void;
  onCancel:     () => void;
}

// ── Number pad keys ───────────────────────────────────────────────────────────
const PAD_KEYS = [
  "1","2","3",
  "4","5","6",
  "7","8","9",
  ".","0","⌫",
];

export default function QRAmountEntry({
  merchantName,
  upiId,
  onConfirm,
  onCancel,
}: QRAmountEntryProps) {
  const [display, setDisplay]   = useState("");
  const [shaking, setShaking]   = useState(false);
  const { auronRate }           = useLiveRate();
  const inputRef                = useRef<HTMLInputElement>(null);

  // Focus input on mount (keyboard entry on desktop)
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ── Live USDC equivalent ──────────────────────────────────────────────────
  const inrAmount  = parseFloat(display) || 0;
  const usdcAmount = inrAmount > 0 ? (inrAmount / auronRate).toFixed(4) : null;

  // ── Numpad logic ──────────────────────────────────────────────────────────
  function pressKey(key: string) {
    if (key === "⌫") {
      setDisplay(prev => prev.slice(0, -1));
      return;
    }

    // Only one decimal point
    if (key === "." && display.includes(".")) return;

    // Max 2 decimal places
    if (display.includes(".")) {
      const decimals = display.split(".")[1] ?? "";
      if (decimals.length >= 2) return;
    }

    // Max ₹2,00,000 per transaction
    const next = display + key;
    if (parseFloat(next) > 200_000) {
      setShaking(true);
      setTimeout(() => setShaking(false), 400);
      return;
    }

    // Don't allow leading zeros
    if (display === "" && key === "0") return;

    setDisplay(next);
  }

  // ── Keyboard input (desktop) ──────────────────────────────────────────────
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key >= "0" && e.key <= "9") pressKey(e.key);
    else if (e.key === ".")           pressKey(".");
    else if (e.key === "Backspace")   pressKey("⌫");
    else if (e.key === "Enter" && inrAmount >= 1) handleConfirm();
    else if (e.key === "Escape")      onCancel();
  }

  function handleConfirm() {
    if (inrAmount < 1) {
      setShaking(true);
      setTimeout(() => setShaking(false), 400);
      return;
    }
    onConfirm(inrAmount);
  }

  const merchant = merchantName || upiId.split("@")[0];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
        onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
      >
        <motion.div
          initial={{ y: 80, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 80, opacity: 0, scale: 0.97 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl overflow-hidden"
          style={{
            background:   "rgba(10,10,18,0.98)",
            border:       "1px solid rgba(201,168,76,0.15)",
            boxShadow:    "0 -24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(201,168,76,0.08)",
          }}
          onKeyDown={handleKeyDown}
          tabIndex={-1}
        >
          {/* Hidden input for keyboard events on desktop */}
          <input
            ref={inputRef}
            className="sr-only"
            onKeyDown={handleKeyDown}
            readOnly
          />

          {/* ── Header ────────────────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <div className="flex items-center gap-3">
              {/* Merchant avatar */}
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center font-black text-lg"
                style={{
                  background:  "linear-gradient(135deg, rgba(201,168,76,0.25), rgba(201,168,76,0.08))",
                  border:      "1px solid rgba(201,168,76,0.3)",
                  color:       "#C9A84C",
                }}
              >
                {merchant.charAt(0).toUpperCase()}
              </div>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#F0EEE8", letterSpacing: "-0.01em" }}>
                  {merchant}
                </p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "monospace" }}>
                  {upiId}
                </p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
              style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.4)" }}
            >
              <X size={14} />
            </button>
          </div>

          {/* ── Amount display ─────────────────────────────────────────────── */}
          <motion.div
            animate={shaking ? { x: [-6, 6, -6, 6, 0] } : { x: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center py-6 px-6"
          >
            <div
              className="flex items-baseline gap-2"
              style={{ minHeight: 72 }}
            >
              <span style={{ fontSize: 36, fontWeight: 800, color: "rgba(255,255,255,0.3)" }}>
                ₹
              </span>
              <span
                className="font-display font-black"
                style={{
                  fontSize:      display ? "clamp(3rem, 15vw, 5rem)" : "4rem",
                  color:         display ? "#F0EEE8" : "rgba(255,255,255,0.15)",
                  letterSpacing: "-0.04em",
                  lineHeight:    1,
                  minWidth:      80,
                  textAlign:     "center",
                  transition:    "font-size 0.1s ease",
                }}
              >
                {display || "0"}
              </span>
            </div>

            {/* Live USDC equivalent */}
            <AnimatePresence>
              {usdcAmount && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="flex items-center gap-2 mt-2"
                >
                  <Zap size={11} style={{ color: "#C9A84C" }} />
                  <span style={{ fontSize: 13, color: "#C9A84C", fontWeight: 600 }}>
                    ~{usdcAmount} USDC
                  </span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>
                    · &lt;$0.001 fee
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ── Number pad ─────────────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-px px-4 pb-2" style={{ background: "rgba(255,255,255,0.03)" }}>
            {PAD_KEYS.map((key) => (
              <motion.button
                key={key}
                onClick={() => pressKey(key)}
                whileTap={{ scale: 0.94 }}
                className="flex items-center justify-center rounded-2xl font-bold"
                style={{
                  height:     64,
                  fontSize:   key === "⌫" ? 18 : 24,
                  color:      key === "⌫" ? "rgba(255,255,255,0.5)" : "#F0EEE8",
                  background: "transparent",
                  transition: "background 0.1s",
                }}
                onMouseDown={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)";
                }}
                onMouseUp={e => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {key === "⌫" ? <Delete size={20} /> : key}
              </motion.button>
            ))}
          </div>

          {/* ── Confirm button ──────────────────────────────────────────────── */}
          <div className="px-4 pb-6 pt-3">
            <motion.button
              onClick={handleConfirm}
              whileHover={inrAmount >= 1 ? { scale: 1.01 } : {}}
              whileTap={inrAmount >= 1 ? { scale: 0.98 } : {}}
              className="w-full flex items-center justify-center gap-3 rounded-2xl font-bold"
              style={{
                height:     58,
                fontSize:   16,
                letterSpacing: "-0.01em",
                background:  inrAmount >= 1
                  ? "linear-gradient(135deg, #C9A84C, #E8C86A)"
                  : "rgba(255,255,255,0.06)",
                color:       inrAmount >= 1 ? "#080810" : "rgba(255,255,255,0.2)",
                cursor:      inrAmount >= 1 ? "pointer" : "not-allowed",
                transition:  "all 0.2s",
              }}
            >
              {inrAmount >= 1 ? (
                <>
                  Pay ₹{inrAmount.toLocaleString("en-IN")}
                  <ArrowRight size={18} />
                </>
              ) : (
                "Enter amount"
              )}
            </motion.button>
          </div>

        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
