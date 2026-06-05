"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ExternalLink, Copy, Check, X, Share2 } from "lucide-react";
import { getTxExplorerUrl } from "@/lib/solana";
import confetti from "canvas-confetti";

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
  usdc:   "#2775CA",
};

interface RevealCardProps {
  txHash: string;
  onClose: () => void;
  merchantName?: string;
  inrAmount?: number;
  usdcAmount?: number;
  utrNumber?: string;
  network?: string;
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');

  .rc-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: rgba(0,0,0,0.82);
    backdrop-filter: blur(10px);
  }

  .rc-sheet {
    width: 100%;
    max-width: 390px;
    background: ${C.s1};
    border-radius: 20px 20px 0 0;
    border-top: 0.5px solid ${C.border};
    overflow: hidden;
    font-family: 'Geist', sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .rc-handle {
    width: 36px; height: 4px;
    border-radius: 999px;
    background: ${C.border};
    margin: 10px auto 0;
  }

  .rc-body {
    padding: 16px 20px 28px;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .rc-table {
    border-radius: 12px;
    overflow: hidden;
    background: ${C.s2};
    border: 1px solid ${C.border};
  }
  .rc-table-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 11px 14px;
    border-bottom: 0.5px solid ${C.border};
  }
  .rc-table-row:last-child { border-bottom: none; }

  .rc-btn-primary {
    width: 100%;
    padding: 14px;
    border-radius: 12px;
    background: ${C.lime};
    border: none;
    font-family: 'Geist', sans-serif;
    font-size: 14px;
    font-weight: 700;
    color: #0A0A08;
    cursor: pointer;
    transition: background 0.15s, transform 0.1s;
  }
  .rc-btn-primary:hover { background: #A3C42A; }
  .rc-btn-primary:active { transform: scale(0.99); }

  .rc-btn-secondary {
    width: 100%;
    padding: 13px;
    border-radius: 12px;
    background: transparent;
    border: 1px solid ${C.border};
    font-family: 'Geist', sans-serif;
    font-size: 13px;
    font-weight: 500;
    color: ${C.muted};
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: border-color 0.15s, color 0.15s;
  }
  .rc-btn-secondary:hover { border-color: ${C.borderB}; color: ${C.text}; }

  .rc-copy-btn {
    padding: 5px;
    border-radius: 6px;
    background: ${C.border};
    border: none;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s;
  }
  .rc-copy-btn:hover { background: ${C.borderB}; }
`;

export default function RevealCard({
  txHash, onClose,
  merchantName, inrAmount, usdcAmount, utrNumber, network = "Solana",
}: RevealCardProps) {
  const [visible, setVisible] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [copiedUtr, setCopiedUtr] = useState(false);

  const txTime = new Date().toLocaleString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const shortHash = txHash.length > 16
    ? `${txHash.slice(0, 8)}…${txHash.slice(-4)}`
    : txHash;

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      confetti({
        particleCount: 60,
        spread: 65,
        origin: { y: 0.5 },
        colors: [C.lime, "#A3C42A", C.gold, "#fff"],
        startVelocity: 30,
        gravity: 0.9,
        scalar: 0.8,
      });
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const t = setTimeout(handleClose, 20_000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 300);
  }

  function copyHash() {
    navigator.clipboard.writeText(txHash).catch(() => {});
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  }

  function copyUtr() {
    if (!utrNumber) return;
    navigator.clipboard.writeText(utrNumber).catch(() => {});
    setCopiedUtr(true);
    setTimeout(() => setCopiedUtr(false), 2000);
  }

  async function shareReceipt() {
    const text = [
      "✅ Payment via Auron",
      merchantName ? `Merchant: ${merchantName}` : "",
      inrAmount ? `Amount: ₹${inrAmount.toLocaleString("en-IN")}` : "",
      usdcAmount ? `Paid: ${usdcAmount.toFixed(4)} USDC` : "",
      `Tx: ${shortHash}`,
      utrNumber ? `UTR: ${utrNumber}` : "",
    ].filter(Boolean).join("\n");
    if (navigator.share) {
      try { await navigator.share({ title: "Auron Receipt", text }); } catch { /* dismissed */ }
    } else {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  }

  return (
    <>
      <style>{STYLES}</style>
      <div
        className="rc-overlay"
        style={{ opacity: visible ? 1 : 0, transition: "opacity 0.3s" }}
        onClick={(e) => e.target === e.currentTarget && handleClose()}
      >
        <motion.div
          className="rc-sheet"
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 380, damping: 38 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="rc-handle" />

          <div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 16px 0" }}>
            <button onClick={handleClose} style={{ padding: 6, borderRadius: 8, background: C.s2, border: `1px solid ${C.border}`, cursor: "pointer", color: C.dim, display: "flex", alignItems: "center" }}>
              <X size={13} />
            </button>
          </div>

          <div className="rc-body">
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, paddingTop: 4 }}>
              <div style={{ position: "relative" }}>
                <motion.div
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 20, delay: 0.1 }}
                  style={{ width: 68, height: 68, borderRadius: "50%", background: "rgba(200,241,53,0.08)", border: `1.5px solid rgba(200,241,53,0.3)`, display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <CheckCircle2 size={32} color={C.lime} />
                </motion.div>
                <motion.div
                  animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
                  style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1.5px solid rgba(200,241,53,0.2)" }}
                />
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontFamily: "'Instrument Serif',serif", fontSize: 22, color: C.text, margin: "0 0 4px" }}>Payment Successful</p>
                <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.dim, margin: 0 }}>Transaction confirmed on Solana</p>
              </div>
            </div>

            <div className="rc-table">
              {[
                { label: "Merchant",    value: merchantName ?? "—" },
                { label: "Amount",      value: inrAmount ? `₹${inrAmount.toLocaleString("en-IN")}` : "—" },
                { label: "Paid",        value: usdcAmount ? `${usdcAmount.toFixed(4)} USDC` : "—" },
                { label: "Network",     value: network },
                { label: "Settlement",  value: "UPI" },
                { label: "Date",        value: txTime },
              ].map(({ label, value }) => (
                <div key={label} className="rc-table-row">
                  <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: C.muted }}>{value}</span>
                </div>
              ))}

              <div className="rc-table-row">
                <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim }}>Tx Hash</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.muted }}>{shortHash}</span>
                  <button className="rc-copy-btn" onClick={copyHash}>
                    {copiedHash ? <Check size={10} color={C.lime} /> : <Copy size={10} color={C.dim} />}
                  </button>
                </div>
              </div>

              {utrNumber && (
                <div className="rc-table-row">
                  <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim }}>UTR</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.gold }}>{utrNumber}</span>
                    <button className="rc-copy-btn" onClick={copyUtr}>
                      {copiedUtr ? <Check size={10} color={C.lime} /> : <Copy size={10} color={C.dim} />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button className="rc-btn-secondary" onClick={shareReceipt}>
                <Share2 size={14} /> Share Receipt
              </button>
              <button className="rc-btn-primary" onClick={handleClose}>
                Done
              </button>
              <a href={getTxExplorerUrl(txHash)} target="_blank" rel="noopener noreferrer"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.dim, textDecoration: "none", padding: 6 }}>
                <ExternalLink size={11} /> View on Solscan
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}
