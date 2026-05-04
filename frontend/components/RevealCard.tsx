"use client";

import { useEffect, useState } from "react";
import { CheckCircle, ExternalLink, Copy, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTxExplorerUrl } from "@/lib/solana";

interface RevealCardProps {
  txHash: string;
  confirmText: string;
  onClose: () => void;
}

export default function RevealCard({ txHash, confirmText, onClose }: RevealCardProps) {
  const [copied, setCopied]   = useState(false);
  const [visible, setVisible] = useState(false);

  const txTime = new Date().toLocaleString("en-IN", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => handleClose(), 18_000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 300);
  }

  function copyHash() {
    navigator.clipboard.writeText(txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const shortHash = txHash.length > 16
    ? `${txHash.slice(0, 8)}…${txHash.slice(-8)}`
    : txHash;

  return (
    <button
      type="button"
      aria-label="Close reveal card"
      className={cn(
        "fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4",
        "bg-black/70 backdrop-blur-md cursor-default",
        "transition-opacity duration-300",
        visible ? "opacity-100" : "opacity-0"
      )}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        className={cn(
          "w-full max-w-md rounded-2xl overflow-hidden",
          "transition-all duration-300 ease-out",
          visible ? "translate-y-0 scale-100" : "translate-y-8 scale-95"
        )}
        style={{
          background: "#12121A",
          border: "1px solid rgba(201,168,76,0.4)",
          boxShadow: "0 0 0 1px rgba(201,168,76,0.1), 0 32px 64px rgba(0,0,0,0.6), 0 0 80px rgba(201,168,76,0.08)",
        }}
      >
        {/* ── Header ───────────────────────────────────────────── */}
        <div
          className="px-6 py-5 flex items-center justify-between"
          style={{ borderBottom: "1px solid rgba(201,168,76,0.15)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(29,158,117,0.15)", border: "1px solid rgba(29,158,117,0.3)" }}
            >
              <CheckCircle size={18} style={{ color: "#1D9E75" }} />
            </div>
            <div>
              <p className="font-display font-bold text-base" style={{ color: "#F0EEE8" }}>
                What just happened
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#8A8A9A" }}>Confirmed on Solana</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={handleClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "#4A4A5A" }}
            onMouseEnter={e => (e.currentTarget.style.color = "#F0EEE8")}
            onMouseLeave={e => (e.currentTarget.style.color = "#4A4A5A")}
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Transaction summary ───────────────────────────────── */}
        <div className="px-6 py-5 space-y-4">

          {/* What happened */}
          <div
            className="rounded-xl p-4"
            style={{ background: "rgba(26,26,38,0.8)", border: "1px solid rgba(201,168,76,0.12)" }}
          >
            <p className="text-xs uppercase tracking-widest font-medium mb-2" style={{ color: "#4A4A5A" }}>
              Transaction
            </p>
            <p className="text-base font-medium leading-relaxed" style={{ color: "#F0EEE8" }}>
              {confirmText}
            </p>
          </div>

          {/* Details grid */}
          <div className="space-y-3">
            <DetailRow label="Recorded on" value="Auron · Solana blockchain" />
            <DetailRow label="Time" value={txTime} />
            <DetailRow
              label="Can be altered?"
              value="No. Ever."
              valueStyle={{ color: "#1D9E75", fontWeight: 600 }}
            />
            <DetailRow label="Network fee" value="< $0.001" />
          </div>

          {/* TX Hash */}
          <div>
            <p className="text-xs uppercase tracking-widest font-medium mb-2" style={{ color: "#4A4A5A" }}>
              Transaction Hash
            </p>
            <div
              className="flex items-center gap-2 rounded-xl px-3 py-2.5"
              style={{ background: "#0A0A0F", border: "1px solid #2A2A3A" }}
            >
              <span className="font-mono text-xs flex-1 truncate" style={{ color: "#8A8A9A" }}>
                {shortHash}
              </span>
              <button
                type="button"
                onClick={copyHash}
                className="p-1.5 rounded-lg transition-colors shrink-0"
                style={{ color: copied ? "#1D9E75" : "#4A4A5A" }}
                title="Copy full hash"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
            </div>
          </div>

          {/* Blockchain education */}
          <div
            className="rounded-xl p-4 gold-border-left"
            style={{ background: "rgba(201,168,76,0.04)" }}
          >
            <p className="text-sm leading-relaxed italic" style={{ color: "#8A8A9A" }}>
              "This is what blockchain means. A record that nobody — not us, not your bank,
              not any government — can change or delete."
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <a
              href={getTxExplorerUrl(txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all duration-150"
              style={{
                background: "rgba(26,26,38,0.8)",
                border: "1px solid #2A2A3A",
                color: "#8A8A9A",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = "rgba(201,168,76,0.3)";
                e.currentTarget.style.color = "#F0EEE8";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = "#2A2A3A";
                e.currentTarget.style.color = "#8A8A9A";
              }}
            >
              <ExternalLink size={14} />
              View on Explorer
            </a>
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-150 btn-gold"
            >
              Continue
            </button>
          </div>

          <p className="text-center text-xs" style={{ color: "#2A2A3A" }}>
            Closes automatically in a few seconds
          </p>
        </div>
      </div>
    </button>
  );
}

function DetailRow({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: string;
  valueStyle?: React.CSSProperties;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm shrink-0" style={{ color: "#4A4A5A" }}>{label}</span>
      <span className="text-sm text-right" style={{ color: "#8A8A9A", ...valueStyle }}>
        {value}
      </span>
    </div>
  );
}
