"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Copy, ExternalLink, Download,
  Shield, X,
} from "lucide-react";
import AuronLogo from "@/components/AuronLogo";
import { PaymentRecord } from "@/lib/payment-state";
import { getTxExplorerUrl } from "@/lib/solana";

// ─── Props ────────────────────────────────────────────────────────────────────
interface PaymentReceiptProps {
  payment: PaymentRecord;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PaymentReceipt({ payment, onClose }: PaymentReceiptProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  async function copy(value: string, field: string) {
    await navigator.clipboard.writeText(value).catch(() => {});
    setCopiedField(field);
    setTimeout(() => setCopiedField((f) => (f === field ? null : f)), 2000);
  }

  function downloadReceipt() {
    const data = {
      receipt: {
        paymentId: payment.paymentId,
        receiptHash: payment.receiptHash,
        timestamp: new Date(payment.initiatedAt).toISOString(),
      },
      payment: {
        inrAmount: payment.inrAmount,
        usdcAmount: payment.usdcAmount,
        fxRate: payment.fxRate,
        merchantUpiId: payment.merchantUpiId,
        merchantName: payment.merchantName,
        utrNumber: payment.utrNumber,
      },
      blockchain: {
        solanaSignature: payment.solanaSignature,
        solanaBlockTime: payment.solanaBlockTime,
        fromAddress: payment.fromAddress,
        toAddress: payment.toAddress,
        network: process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet",
      },
      offramp: {
        provider: "OnMeta",
        payoutId: payment.onmetaPayoutId,
        utrNumber: payment.utrNumber,
        completedAt: payment.completedAt
          ? new Date(payment.completedAt).toISOString()
          : null,
      },
      auditTrail: payment.events.map((e) => ({
        timestamp: new Date(e.timestamp).toISOString(),
        status: e.status,
        message: e.message,
      })),
      verification: {
        hashAlgorithm: "SHA-256",
        canonicalFormat:
          "paymentId|solanaSignature|usdcAmount(6dp)|inrAmount(2dp)|merchantUpiId|fromAddress|confirmedAt",
        instructions:
          "Concatenate the fields above with | separator and SHA-256 hash to verify receiptHash.",
      },
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auron-receipt-${payment.paymentId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const confirmedDate = payment.confirmedAt
    ? new Date(payment.confirmedAt).toLocaleString("en-IN", {
        day: "numeric", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      })
    : null;

  const durationSec = payment.completedAt && payment.initiatedAt
    ? ((payment.completedAt - payment.initiatedAt) / 1000).toFixed(1)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        className="w-full max-w-sm overflow-hidden"
        style={{
          background: "#0A0A0F",
          border: "1px solid rgba(16,185,129,0.2)",
          borderBottom: "none",
          borderRadius: "24px 24px 0 0",
          maxHeight: "90dvh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4"
          style={{ borderBottom: "1px solid rgba(16,185,129,0.12)" }}>
          <div className="flex items-center gap-3">
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 18, delay: 0.1 }}
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)" }}
            >
              <CheckCircle2 size={18} className="text-emerald-400" />
            </motion.div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-white">Payment Receipt</p>
              <p className="text-[10px] mt-0.5" style={{ color: "#10b981" }}>
                ₹{payment.inrAmount.toLocaleString("en-IN")} · Delivered
              </p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "var(--text-muted)" }}>
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">

          {/* ── Summary card ────────────────────────────────────── */}
          <div className="rounded-2xl p-4"
            style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.16)" }}>
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-3xl font-black text-white" style={{ letterSpacing: "-0.03em" }}>
                ₹{payment.inrAmount.toLocaleString("en-IN")}
              </span>
              {durationSec && (
                <span className="text-[10px] font-semibold px-2 py-1 rounded-full"
                  style={{ background: "rgba(16,185,129,0.12)", color: "#10b981" }}>
                  ⚡ {durationSec}s
                </span>
              )}
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>To</span>
                <span className="text-[11px] font-semibold text-white">
                  {payment.merchantName || payment.merchantUpiId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>Via</span>
                <span className="text-[11px] font-mono text-white">{payment.merchantUpiId}</span>
              </div>
              {confirmedDate && (
                <div className="flex justify-between">
                  <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>When</span>
                  <span className="text-[11px] text-white">{confirmedDate}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Cost breakdown ──────────────────────────────────── */}
          <div className="rounded-xl p-3 space-y-2"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <p className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: "var(--text-muted)" }}>
              Cost breakdown
            </p>
            <CopyRow label="USDC spent" value={`${payment.usdcAmount.toFixed(6)} USDC`}
              onCopy={() => copy(payment.usdcAmount.toFixed(6), "usdc")}
              copied={copiedField === "usdc"} />
            <div className="flex justify-between">
              <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>FX rate</span>
              <span className="text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>
                1 USDC = ₹{payment.fxRate.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between rounded-lg px-3 py-1.5"
              style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.15)" }}>
              <span className="text-[10px] font-semibold text-emerald-400">Your fee</span>
              <span className="text-[10px] font-black text-emerald-400">₹0</span>
            </div>
          </div>

          {/* ── UTR Number ─────────────────────────────────────── */}
          {payment.utrNumber && (
            <div className="rounded-xl p-3 space-y-1"
              style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.18)" }}>
              <p className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: "rgba(201,168,76,0.6)" }}>
                UPI Transaction Reference
              </p>
              <CopyRow label="UTR Number" value={payment.utrNumber}
                onCopy={() => copy(payment.utrNumber!, "utr")}
                copied={copiedField === "utr"}
                gold mono />
            </div>
          )}

          {/* ── On-chain proof ──────────────────────────────────── */}
          <div className="rounded-xl p-3 space-y-2"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="flex items-center gap-1.5 mb-1">
              <Shield size={11} style={{ color: "rgba(201,168,76,0.7)" }} />
              <p className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: "var(--text-muted)" }}>
                On-chain proof (Solana)
              </p>
            </div>

            {payment.solanaSignature && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>Tx signature</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono" style={{ color: "var(--text-secondary)" }}>
                    {payment.solanaSignature.slice(0, 8)}…{payment.solanaSignature.slice(-6)}
                  </span>
                  <button onClick={() => copy(payment.solanaSignature!, "sig")}
                    className="p-1 rounded-lg transition-all"
                    style={{ background: "rgba(255,255,255,0.05)" }}>
                    <AnimatePresence mode="wait">
                      {copiedField === "sig"
                        ? <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                            <CheckCircle2 size={10} className="text-emerald-400" />
                          </motion.div>
                        : <motion.div key="copy" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                            <Copy size={10} style={{ color: "var(--text-muted)" }} />
                          </motion.div>
                      }
                    </AnimatePresence>
                  </button>
                  <a href={getTxExplorerUrl(payment.solanaSignature)} target="_blank" rel="noopener noreferrer"
                    className="p-1 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <ExternalLink size={10} style={{ color: "var(--text-muted)" }} />
                  </a>
                </div>
              </div>
            )}

            {payment.receiptHash && (
              <CopyRow
                label="Receipt hash (SHA-256)"
                value={payment.receiptHash.slice(0, 16) + "…"}
                onCopy={() => copy(payment.receiptHash!, "hash")}
                copied={copiedField === "hash"}
                mono
              />
            )}

            <CopyRow
              label="Payment ID"
              value={payment.paymentId}
              onCopy={() => copy(payment.paymentId, "pid")}
              copied={copiedField === "pid"}
              mono
            />
          </div>

          {/* ── Auron branding ──────────────────────────────────── */}
          <div className="flex items-center justify-center gap-2 py-1">
            <AuronLogo size={16} />
            <span className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,0.2)" }}>
              Powered by Auron · Solana · OnMeta
            </span>
          </div>

          {/* ── Download ────────────────────────────────────────── */}
          <motion.button
            onClick={downloadReceipt}
            whileTap={{ scale: 0.97 }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "var(--text-secondary)",
            }}
          >
            <Download size={13} />
            Download receipt (.json)
          </motion.button>
        </div>

        {/* Safe area */}
        <div style={{ height: "max(16px, env(safe-area-inset-bottom))" }} />
      </motion.div>
    </motion.div>
  );
}

// ─── Copy row helper ──────────────────────────────────────────────────────────
function CopyRow({
  label, value, onCopy, copied, mono = false, gold = false,
}: {
  label: string; value: string; onCopy: () => void;
  copied: boolean; mono?: boolean; gold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[10px] shrink-0" style={{ color: "var(--text-muted)" }}>{label}</span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className={`text-[10px] font-semibold truncate ${mono ? "font-mono" : ""}`}
          style={{ color: gold ? "#C9A84C" : "var(--text-secondary)" }}
        >
          {value}
        </span>
        <button onClick={onCopy}
          className="p-1 rounded-lg shrink-0 transition-all"
          style={{ background: "rgba(255,255,255,0.05)" }}>
          <AnimatePresence mode="wait">
            {copied
              ? <motion.div key="c" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <CheckCircle2 size={10} className="text-emerald-400" />
                </motion.div>
              : <motion.div key="u" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <Copy size={10} style={{ color: "var(--text-muted)" }} />
                </motion.div>
            }
          </AnimatePresence>
        </button>
      </div>
    </div>
  );
}
