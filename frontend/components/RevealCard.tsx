"use client";

import { useEffect, useState } from "react";
import { CheckCircle, ExternalLink, Copy, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface RevealCardProps {
  txHash: string;
  confirmText: string;
  onClose: () => void;
}

// Initia testnet explorer base URL
const EXPLORER_BASE = "https://scan.testnet.initia.xyz/auron-1/txs";

export default function RevealCard({ txHash, confirmText, onClose }: RevealCardProps) {
  const [copied, setCopied]     = useState(false);
  const [visible, setVisible]   = useState(false);

  // Animate in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  // Auto-close after 12 seconds
  useEffect(() => {
    const t = setTimeout(() => handleClose(), 12_000);
    return () => clearTimeout(t);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 250);
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
      aria-label="Close"
      className={cn(
        "fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4",
        "bg-black/60 backdrop-blur-sm cursor-default",
        "transition-opacity duration-250",
        visible ? "opacity-100" : "opacity-0"
      )}
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div
        className={cn(
          "w-full max-w-md rounded-2xl overflow-hidden shadow-2xl",
          "border border-white/10",
          "transition-transform duration-250",
          visible ? "translate-y-0" : "translate-y-6"
        )}
      >
        {/* ── Green success banner ──────────────────────────────── */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <CheckCircle size={22} className="text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-base leading-tight">Done!</p>
                <p className="text-emerald-100 text-xs mt-0.5">Confirmed on-chain</p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={handleClose}
              className="p-1.5 rounded-lg hover:bg-white/20 text-white/70 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────── */}
        <div className="bg-[#161b27] px-6 py-5 space-y-5">

          {/* What happened */}
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-widest font-medium mb-1.5">
              Transaction
            </p>
            <p className="text-white font-medium text-sm leading-relaxed">
              {confirmText}
            </p>
          </div>

          {/* TX Hash */}
          <div>
            <p className="text-gray-400 text-xs uppercase tracking-widest font-medium mb-1.5">
              Transaction Hash
            </p>
            <div className="flex items-center gap-2 bg-[#0f1117] rounded-xl px-3 py-2.5 border border-white/6">
              <span className="text-gray-300 text-xs font-mono flex-1 truncate">
                {shortHash}
              </span>
              <button
                type="button"
                onClick={copyHash}
                className={cn(
                  "p-1.5 rounded-lg transition-colors shrink-0",
                  copied
                    ? "text-emerald-400 bg-emerald-400/10"
                    : "text-gray-500 hover:text-gray-300 hover:bg-white/6"
                )}
                title="Copy full hash"
              >
                {copied ? <Check size={13} /> : <Copy size={13} />}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <a
              href={`${EXPLORER_BASE}/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex-1 flex items-center justify-center gap-2",
                "py-2.5 rounded-xl text-sm font-medium",
                "bg-white/6 hover:bg-white/10 text-gray-200",
                "border border-white/8 hover:border-white/16",
                "transition-all duration-150"
              )}
            >
              <ExternalLink size={14} />
              View on Explorer
            </a>

            <button
              type="button"
              onClick={handleClose}
              className={cn(
                "flex-1 py-2.5 rounded-xl text-sm font-semibold",
                "bg-emerald-600 hover:bg-emerald-500 text-white",
                "transition-all duration-150 active:scale-95"
              )}
            >
              Continue
            </button>
          </div>

          {/* Auto-close note */}
          <p className="text-center text-gray-600 text-[10px]">
            This will close automatically in a few seconds
          </p>
        </div>
      </div>
    </button>
  );
}
