"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, ExternalLink, Copy, Check, X, Share2 } from "lucide-react";
import { getTxExplorerUrl } from "@/lib/solana";
import confetti from "canvas-confetti";

interface RevealCardProps {
  txHash: string;
  confirmText: string;
  onClose: () => void;
  // Optional rich receipt data
  merchantName?: string;
  inrAmount?: number;
  usdcAmount?: number;
  utrNumber?: string;
  network?: string;
}

export default function RevealCard({
  txHash, confirmText, onClose,
  merchantName, inrAmount, usdcAmount, utrNumber, network = "Solana",
}: RevealCardProps) {
  const [visible,     setVisible]     = useState(false);
  const [copiedHash,  setCopiedHash]  = useState(false);
  const [copiedUtr,   setCopiedUtr]   = useState(false);

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

  // Confetti on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.5 },
        colors: ["#22C55E", "#3B82F6", "#22D3EE", "#A78BFA", "#F8FAFC"],
        startVelocity: 35,
        gravity: 0.9,
        scalar: 0.85,
      });
    }, 200);
    return () => clearTimeout(timer);
  }, []);

  // Auto-close
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
      "✅ Payment Successful via Auron",
      merchantName ? `Merchant: ${merchantName}` : "",
      inrAmount ? `Amount: ₹${inrAmount.toLocaleString("en-IN")}` : "",
      usdcAmount ? `Paid: ${usdcAmount.toFixed(4)} USDC` : "",
      `Network: ${network}`,
      `Tx: ${shortHash}`,
      utrNumber ? `UTR: ${utrNumber}` : "",
    ].filter(Boolean).join("\n");

    if (navigator.share) {
      try { await navigator.share({ title: "Auron Payment Receipt", text }); } catch { /* dismissed */ }
    } else {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  }

  return (
    <button
      type="button"
      aria-label="Close payment receipt"
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)", cursor: "default" }}
      onClick={e => e.target === e.currentTarget && handleClose()}
    >
      <motion.div
        initial={{ y: 60, scale: 0.96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 40, scale: 0.97 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
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

        {/* Close button */}
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 16px 0" }}>
          <button onClick={handleClose} style={{ padding: 6, borderRadius: 8, background: "rgba(148,163,184,0.08)", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex", alignItems: "center" }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: "12px 20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Success icon + title */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, paddingTop: 8 }}>
            <div style={{ position: "relative" }}>
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 20, delay: 0.1 }}
                style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(34,197,94,0.12)", border: "2px solid rgba(34,197,94,0.4)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 40px rgba(34,197,94,0.25)" }}
              >
                <CheckCircle size={36} color="#22C55E" />
              </motion.div>
              {/* Pulse */}
              <motion.div
                animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
                style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "2px solid rgba(34,197,94,0.35)" }}
              />
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 6px", letterSpacing: "-0.03em" }}>Payment Successful</p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>Your payment has been completed.</p>
            </div>
          </div>

          {/* Receipt table */}
          <div style={{ borderRadius: 16, background: "rgba(15,23,42,0.7)", border: "1px solid rgba(148,163,184,0.08)", overflow: "hidden" }}>
            {[
              { label: "Merchant",   value: merchantName ?? confirmText.split(" ")[0] ?? "—" },
              { label: "Amount",     value: inrAmount ? `₹${inrAmount.toLocaleString("en-IN")}` : "—" },
              { label: "Paid",       value: usdcAmount ? `${usdcAmount.toFixed(2)} USDC` : "—" },
              { label: "Network",    value: network },
              { label: "Settlement", value: "UPI" },
              { label: "Date & Time", value: txTime },
            ].map(({ label, value }, i, arr) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: i < arr.length - 1 ? "1px solid rgba(148,163,184,0.06)" : "none" }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{value}</span>
              </div>
            ))}

            {/* Tx Hash row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: "1px solid rgba(148,163,184,0.06)" }}>
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Transaction Hash</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-secondary)" }}>{shortHash}</span>
                <button onClick={copyHash} style={{ padding: 5, borderRadius: 6, background: "rgba(148,163,184,0.08)", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
                  {copiedHash ? <Check size={11} color="#22C55E" /> : <Copy size={11} color="var(--text-muted)" />}
                </button>
              </div>
            </div>

            {/* UTR row */}
            {utrNumber && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderTop: "1px solid rgba(148,163,184,0.06)" }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>UPI Reference (UTR)</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, fontFamily: "monospace", color: "var(--text-secondary)" }}>{utrNumber}</span>
                  <button onClick={copyUtr} style={{ padding: 5, borderRadius: 6, background: "rgba(148,163,184,0.08)", border: "none", cursor: "pointer", display: "flex", alignItems: "center" }}>
                    {copiedUtr ? <Check size={11} color="#22C55E" /> : <Copy size={11} color="var(--text-muted)" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Share receipt */}
            <button onClick={shareReceipt}
              style={{ width: "100%", padding: "13px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(148,163,184,0.15)", fontSize: 14, fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Share2 size={15} /> Share Receipt
            </button>

            {/* Back to home */}
            <motion.button onClick={handleClose}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              style={{ width: "100%", padding: "13px", borderRadius: 12, background: "#3B82F6", border: "none", fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: "0 4px 20px rgba(59,130,246,0.4)" }}>
              Back to Home
            </motion.button>

            {/* View on explorer */}
            <a href={getTxExplorerUrl(txHash)} target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 12, color: "var(--text-muted)", textDecoration: "none", padding: "6px" }}>
              <ExternalLink size={12} /> View on Solscan
            </a>
          </div>
        </div>
      </motion.div>
    </button>
  );
}
