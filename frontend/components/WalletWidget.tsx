"use client";

import { useState, useRef, useEffect, type ElementType } from "react";
import { useInterwovenKit, usePortfolio } from "@initia/interwovenkit-react";
import { Wallet, ChevronDown, Copy, ArrowDownToLine, Check } from "lucide-react";
import { cn, shortAddr, formatCless } from "@/lib/utils";

export default function WalletWidget() {
  const {
    address,
    username,
    isConnected,
    openConnect,
    openWallet,
    openDeposit,
  } = useInterwovenKit();

  const { totalValue, assetGroups } = usePortfolio();

  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Get CLESS balance from portfolio
  const clessBalance = (() => {
    for (const group of assetGroups ?? []) {
      for (const asset of group.assets ?? []) {
        if (
          asset.denom === "ucless" ||
          asset.symbol?.toLowerCase() === "cless"
        ) {
          return formatCless(asset.amount ?? 0);
        }
      }
    }
    return "0";
  })();

  const displayName = username ?? shortAddr(address);

  function copyAddress() {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDeposit() {
    setOpen(false);
    openDeposit({ denoms: ["ucless"] });
  }

  // ── Not connected ────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <button
        onClick={openConnect}
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold",
          "bg-violet-600 hover:bg-violet-500 text-white",
          "transition-all duration-150 active:scale-95",
          "animate-pulse-glow"
        )}
      >
        <Wallet size={15} />
        Connect Wallet
      </button>
    );
  }

  // ── Connected ────────────────────────────────────────────────────
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium",
          "bg-[#161b27] border border-white/10 hover:border-white/20",
          "text-white transition-all duration-150 active:scale-95"
        )}
      >
        {/* Green dot */}
        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />

        {/* Name + balance */}
        <span className="flex flex-col items-start leading-none">
          <span className="text-white font-semibold text-xs">{displayName}</span>
          <span className="text-gray-400 text-[10px] mt-0.5">{clessBalance} CLESS</span>
        </span>

        <ChevronDown
          size={14}
          className={cn(
            "text-gray-400 transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={cn(
            "absolute right-0 top-full mt-2 w-56 rounded-2xl z-50",
            "bg-[#161b27] border border-white/10 shadow-2xl",
            "animate-slide-up overflow-hidden"
          )}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/6">
            <p className="text-white font-semibold text-sm">{displayName}</p>
            <p className="text-gray-400 text-xs mt-0.5 font-mono">
              {shortAddr(address)}
            </p>
            {totalValue > 0 && (
              <p className="text-violet-300 text-xs mt-1">
                ≈ ${totalValue.toFixed(2)} total
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="p-2 space-y-0.5">
            <DropdownItem
              icon={copied ? Check : Copy}
              label={copied ? "Copied!" : "Copy address"}
              onClick={copyAddress}
              accent={copied}
            />
            <DropdownItem
              icon={ArrowDownToLine}
              label="Deposit funds"
              onClick={handleDeposit}
            />
            <DropdownItem
              icon={Wallet}
              label="Wallet details"
              onClick={() => { setOpen(false); openWallet(); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small helper ─────────────────────────────────────────────────
function DropdownItem({
  icon: Icon,
  label,
  onClick,
  accent = false,
  danger = false,
}: {
  readonly icon: ElementType;
  readonly label: string;
  readonly onClick: () => void;
  readonly accent?: boolean;
  readonly danger?: boolean;
}) {
  function colorClass(): string {
    if (danger) return "text-red-400 hover:bg-red-950/60";
    if (accent) return "text-emerald-400 hover:bg-emerald-950/40";
    return "text-gray-300 hover:bg-white/6";
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm",
        "transition-colors duration-100",
        colorClass()
      )}
    >
      <Icon size={15} className="shrink-0" />
      {label}
    </button>
  );
}
