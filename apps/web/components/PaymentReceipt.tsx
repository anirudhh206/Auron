"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Copy, ExternalLink, Download, Shield, X } from "lucide-react";
import AuronLogo from "@/components/AuronLogo";
import { PaymentRecord } from "@/lib/payment-state";
import { getTxExplorerUrl } from "@/lib/solana";

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
  error:  "#EF4444",
};

interface PaymentReceiptProps {
  payment: PaymentRecord;
  onClose: () => void;
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');

  .pr-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: rgba(0,0,0,0.75);
    backdrop-filter: blur(8px);
  }

  .pr-sheet {
    width: 100%;
    max-width: 390px;
    max-height: 92dvh;
    overflow-y: auto;
    background: ${C.s1};
    border-radius: 20px 20px 0 0;
    border-top: 0.5px solid ${C.border};
    font-family: 'Geist', sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .pr-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px;
    border-bottom: 0.5px solid ${C.border};
    position: sticky;
    top: 0;
    background: ${C.s1};
    z-index: 1;
  }

  .pr-close {
    width: 30px; height: 30px;
    border-radius: 8px;
    background: ${C.s2};
    border: 1px solid ${C.border};
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    color: ${C.dim};
    transition: border-color 0.15s, color 0.15s;
  }
  .pr-close:hover { border-color: ${C.borderB}; color: ${C.muted}; }

  .pr-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .pr-summary {
    border-radius: 14px;
    padding: 16px;
    background: rgba(200,241,53,0.04);
    border: 1px solid rgba(200,241,53,0.12);
  }

  .pr-section {
    border-radius: 12px;
    overflow: hidden;
    background: ${C.s2};
    border: 1px solid ${C.border};
  }
  .pr-section-label {
    font-family: 'Geist Mono', monospace;
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: ${C.dim};
    padding: 10px 14px 6px;
  }
  .pr-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-top: 0.5px solid ${C.border};
  }
  .pr-row:first-of-type { border-top: none; }

  .pr-utr {
    border-radius: 12px;
    padding: 14px 16px;
    background: rgba(245,166,35,0.05);
    border: 1px solid rgba(245,166,35,0.15);
  }

  .pr-copy {
    padding: 5px;
    border-radius: 6px;
    background: ${C.border};
    border: none;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s;
    flex-shrink: 0;
  }
  .pr-copy:hover { background: ${C.borderB}; }

  .pr-download {
    width: 100%;
    padding: 13px;
    border-radius: 12px;
    background: ${C.s2};
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
  .pr-download:hover { border-color: ${C.borderB}; color: ${C.text}; }
`;

export default function PaymentReceipt({ payment, onClose }: PaymentReceiptProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  async function copy(value: string, field: string) {
    await navigator.clipboard.writeText(value).catch(() => {});
    setCopiedField(field);
    setTimeout(() => setCopiedField((f) => (f === field ? null : f)), 2000);
  }

  function downloadReceipt() {
    const data = {
      receipt: { paymentId: payment.paymentId, receiptHash: payment.receiptHash, timestamp: new Date(payment.initiatedAt).toISOString() },
      payment: { inrAmount: payment.inrAmount, usdcAmount: payment.usdcAmount, fxRate: payment.fxRate, merchantUpiId: payment.merchantUpiId, merchantName: payment.merchantName, utrNumber: payment.utrNumber },
      blockchain: { solanaSignature: payment.solanaSignature, solanaBlockTime: payment.solanaBlockTime, fromAddress: payment.fromAddress, toAddress: payment.toAddress, network: process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet" },
      offramp: { provider: "OnMeta", payoutId: payment.onmetaPayoutId, utrNumber: payment.utrNumber, completedAt: payment.completedAt ? new Date(payment.completedAt).toISOString() : null },
      auditTrail: payment.events.map((e) => ({ timestamp: new Date(e.timestamp).toISOString(), status: e.status, message: e.message })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `auron-receipt-${payment.paymentId.slice(0, 8)}.json`;
    a.click(); URL.revokeObjectURL(url);
  }

  const confirmedDate = payment.confirmedAt
    ? new Date(payment.confirmedAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : null;

  const durationSec = payment.completedAt && payment.initiatedAt
    ? ((payment.completedAt - payment.initiatedAt) / 1000).toFixed(1)
    : null;

  return (
    <>
      <style>{STYLES}</style>
      <motion.div className="pr-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <motion.div
          className="pr-sheet"
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 380, damping: 38 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="pr-header">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 18, delay: 0.1 }}
                style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(200,241,53,0.08)", border: "1px solid rgba(200,241,53,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              >
                <CheckCircle2 size={18} color={C.lime} />
              </motion.div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>Payment Receipt</p>
                <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.lime, margin: "2px 0 0" }}>
                  ₹{payment.inrAmount.toLocaleString("en-IN")} · Delivered
                </p>
              </div>
            </div>
            <button className="pr-close" onClick={onClose}><X size={14} /></button>
          </div>

          <div className="pr-body">
            <div className="pr-summary">
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontFamily: "'Instrument Serif',serif", fontSize: 32, color: C.text, letterSpacing: "-0.02em" }}>
                  ₹{payment.inrAmount.toLocaleString("en-IN")}
                </span>
                {durationSec && (
                  <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.lime, padding: "4px 10px", background: "rgba(200,241,53,0.08)", border: "1px solid rgba(200,241,53,0.15)", borderRadius: 100 }}>
                    ⚡ {durationSec}s
                  </span>
                )}
              </div>
              {[
                { label: "To", value: payment.merchantName || payment.merchantUpiId },
                { label: "Via", value: payment.merchantUpiId, mono: true },
                ...(confirmedDate ? [{ label: "When", value: confirmedDate, mono: false }] : []),
              ].map(({ label, value, mono }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim }}>{label}</span>
                  <span style={{ fontFamily: mono ? "'Geist Mono',monospace" : "'Geist',sans-serif", fontSize: 12, fontWeight: 500, color: C.muted }}>{value}</span>
                </div>
              ))}
            </div>

            <div className="pr-section">
              <p className="pr-section-label">Cost Breakdown</p>
              <div className="pr-row">
                <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim }}>USDC spent</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 12, color: C.usdc }}>{payment.usdcAmount.toFixed(6)} USDC</span>
                  <button className="pr-copy" onClick={() => copy(payment.usdcAmount.toFixed(6), "usdc")}>
                    <AnimatePresence mode="wait">
                      {copiedField === "usdc"
                        ? <motion.div key="c" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><CheckCircle2 size={10} color={C.lime} /></motion.div>
                        : <motion.div key="u" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Copy size={10} color={C.dim} /></motion.div>}
                    </AnimatePresence>
                  </button>
                </div>
              </div>
              <div className="pr-row">
                <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim }}>FX rate</span>
                <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 12, color: C.muted }}>1 USDC = ₹{payment.fxRate.toFixed(2)}</span>
              </div>
              <div className="pr-row" style={{ background: "rgba(200,241,53,0.04)" }}>
                <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.lime }}>Your fee</span>
                <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 13, fontWeight: 700, color: C.lime }}>₹0</span>
              </div>
            </div>

            {payment.utrNumber && (
              <div className="pr-utr">
                <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 9, color: "rgba(245,166,35,0.5)", letterSpacing: "0.12em", marginBottom: 8 }}>
                  UPI TRANSACTION REFERENCE
                </p>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 15, fontWeight: 500, color: C.gold }}>{payment.utrNumber}</span>
                  <button className="pr-copy" onClick={() => copy(payment.utrNumber!, "utr")}>
                    <AnimatePresence mode="wait">
                      {copiedField === "utr"
                        ? <motion.div key="c" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><CheckCircle2 size={11} color={C.lime} /></motion.div>
                        : <motion.div key="u" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Copy size={11} color={C.dim} /></motion.div>}
                    </AnimatePresence>
                  </button>
                </div>
              </div>
            )}

            <div className="pr-section">
              <p className="pr-section-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Shield size={10} color={C.dim} /> On-chain proof
              </p>
              {payment.solanaSignature && (
                <div className="pr-row">
                  <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim }}>Tx signature</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.muted }}>
                      {payment.solanaSignature.slice(0, 8)}…{payment.solanaSignature.slice(-6)}
                    </span>
                    <button className="pr-copy" onClick={() => copy(payment.solanaSignature!, "sig")}>
                      <AnimatePresence mode="wait">
                        {copiedField === "sig"
                          ? <motion.div key="c" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><CheckCircle2 size={10} color={C.lime} /></motion.div>
                          : <motion.div key="u" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Copy size={10} color={C.dim} /></motion.div>}
                      </AnimatePresence>
                    </button>
                    <a href={getTxExplorerUrl(payment.solanaSignature)} target="_blank" rel="noopener noreferrer"
                      style={{ display: "flex", alignItems: "center" }}>
                      <ExternalLink size={10} color={C.dim} />
                    </a>
                  </div>
                </div>
              )}
              {payment.receiptHash && (
                <div className="pr-row">
                  <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim }}>Receipt hash</span>
                  <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim }}>
                    {payment.receiptHash.slice(0, 16)}…
                  </span>
                </div>
              )}
              <div className="pr-row">
                <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim }}>Payment ID</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim }}>
                    {payment.paymentId.slice(0, 12)}…
                  </span>
                  <button className="pr-copy" onClick={() => copy(payment.paymentId, "pid")}>
                    <AnimatePresence mode="wait">
                      {copiedField === "pid"
                        ? <motion.div key="c" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><CheckCircle2 size={10} color={C.lime} /></motion.div>
                        : <motion.div key="u" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Copy size={10} color={C.dim} /></motion.div>}
                    </AnimatePresence>
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "4px 0" }}>
              <AuronLogo size={14} />
              <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 9, color: C.border, letterSpacing: "0.08em" }}>
                POWERED BY AURON · SOLANA · ONMETA
              </span>
            </div>

            <button className="pr-download" onClick={downloadReceipt}>
              <Download size={13} />
              Download receipt (.json)
            </button>
          </div>
          <div style={{ height: "max(16px, env(safe-area-inset-bottom))" }} />
        </motion.div>
      </motion.div>
    </>
  );
}
