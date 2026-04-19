"use client";

import { useEffect, useState, type ElementType } from "react";
import { X, ExternalLink, ArrowUpRight, FileText, Lock, FileCheck, Inbox } from "lucide-react";
import { useStore, CompletedTransaction } from "@/store/useStore";
import { cn, shortAddr, formatTimestamp, formatCless } from "@/lib/utils";

const EXPLORER_BASE = "https://scan.testnet.initia.xyz/auron-1/txs";

const ACTION_META: Record<
  string,
  { label: string; icon: ElementType; color: string; bg: string }
> = {
  transfer: {
    label: "Sent",
    icon: ArrowUpRight,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
  },
  stamp_agreement: {
    label: "Agreement",
    icon: FileText,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  lock_savings: {
    label: "Locked",
    icon: Lock,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  stamp_ownership: {
    label: "Ownership",
    icon: FileCheck,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
};

interface Props {
  readonly onClose: () => void;
}

export default function TransactionHistory({ onClose }: Props) {
  const { completedTxs } = useStore();
  const [visible, setVisible] = useState(false);

  // Animate in
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 250);
  }

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close history"
        className={cn(
          "fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-250 cursor-default",
          visible ? "opacity-100" : "opacity-0"
        )}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full z-50 w-full max-w-sm",
          "bg-[#0f1117] border-l border-white/8 shadow-2xl",
          "flex flex-col transition-transform duration-250",
          visible ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/6 shrink-0">
          <div>
            <h2 className="text-white font-semibold text-base">History</h2>
            <p className="text-gray-500 text-xs mt-0.5">
              {completedTxs.length} transaction{completedTxs.length === 1 ? "" : "s"}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close history"
            onClick={handleClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/6 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {completedTxs.length === 0 ? (
            <Empty />
          ) : (
            <div className="p-3 space-y-2">
              {completedTxs.map((tx) => (
                <TxRow key={tx.id} tx={tx} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Single transaction row ────────────────────────────────────
function TxRow({ tx }: { readonly tx: CompletedTransaction }) {
  const meta = ACTION_META[tx.action.action ?? "transfer"] ?? ACTION_META.transfer;
  const Icon = meta.icon;

  const detail = (() => {
    switch (tx.action.action) {
      case "transfer":
        return `${formatCless((tx.action.amount ?? 0) * 1_000_000)} CLESS → ${tx.action.recipient ?? ""}`;
      case "stamp_agreement":
        return tx.action.description ?? tx.action.recipient ?? "Agreement recorded";
      case "lock_savings":
        return `${formatCless((tx.action.amount ?? 0) * 1_000_000)} CLESS for ${tx.action.duration_days ?? 0} days`;
      case "stamp_ownership":
        return tx.action.file_name ?? "File stamped";
      default:
        return tx.confirmText;
    }
  })();

  return (
    <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#161b27] border border-white/6 hover:border-white/10 transition-colors group">

      {/* Icon */}
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5", meta.bg)}>
        <Icon size={16} className={meta.color} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("text-xs font-semibold uppercase tracking-wider", meta.color)}>
            {meta.label}
          </span>
          <span className="text-gray-600 text-[10px] shrink-0">
            {formatTimestamp(tx.timestamp / 1000)}
          </span>
        </div>
        <p className="text-gray-300 text-sm mt-0.5 truncate">{detail}</p>
        <a
          href={`${EXPLORER_BASE}/${tx.txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-gray-600 hover:text-violet-400 text-[10px] mt-1 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {shortAddr(tx.txHash)}
          <ExternalLink size={9} />
        </a>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────
function Empty() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 px-6 py-20 text-center">
      <div className="w-12 h-12 rounded-2xl bg-white/4 flex items-center justify-center">
        <Inbox size={22} className="text-gray-600" />
      </div>
      <p className="text-gray-400 font-medium text-sm">No transactions yet</p>
      <p className="text-gray-600 text-xs max-w-[200px]">
        Your completed transactions will appear here
      </p>
    </div>
  );
}
