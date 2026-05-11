"use client";

import { useState, useRef, useEffect, type ElementType } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useQuery } from "@tanstack/react-query";
import { Wallet, ChevronDown, Copy, ExternalLink, Check, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { shortAddr, getSOLBalance, getUSDCBalance } from "@/lib/solana";

/** True if running in a mobile browser (not desktop, not Phantom in-app browser) */
function useIsMobileNonPhantom() {
  const [isMobileNonPhantom, setIsMobileNonPhantom] = useState(false);
  useEffect(() => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isPhantomBrowser = !!(window as any).phantom?.solana;
    setIsMobileNonPhantom(isMobile && !isPhantomBrowser);
  }, []);
  return isMobileNonPhantom;
}

export default function WalletWidget() {
  const { publicKey, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const address = publicKey?.toString() ?? null;
  const isMobileNonPhantom = useIsMobileNonPhantom();

  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: solBalance = 0 } = useQuery({
    queryKey: ["sol-balance", address],
    queryFn: () => getSOLBalance(address!),
    enabled: !!address,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const { data: usdcBalance = 0 } = useQuery({
    queryKey: ["usdc-balance", address],
    queryFn: () => getUSDCBalance(address!),
    enabled: !!address,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function copyAddress() {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function openSolscan() {
    if (!address) return;
    window.open(`https://solscan.io/account/${address}`, "_blank", "noopener,noreferrer");
    setOpen(false);
  }

  async function handleDisconnect() {
    setOpen(false);
    await disconnect();
  }

  // ── Not connected ────────────────────────────────────────────────
  if (!connected) {
    // On mobile browsers (outside Phantom's in-app browser), deep-link
    // connections fail with "Could not decrypt Phantom response".
    // Guide the user to open the site inside Phantom's browser instead.
    if (isMobileNonPhantom) {
      const phantomUrl = `https://phantom.app/ul/browse/${encodeURIComponent(
        typeof window !== "undefined" ? window.location.href : "https://auron-mocha.vercel.app"
      )}?ref=${encodeURIComponent("https://auron-mocha.vercel.app")}`;

      return (
        <a
          href={phantomUrl}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold",
            "bg-violet-600 hover:bg-violet-500 text-white",
            "transition-all duration-150 active:scale-95"
          )}
        >
          <Wallet size={15} />
          Open in Phantom
        </a>
      );
    }

    return (
      <button
        onClick={() => setVisible(true)}
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

        {/* Address + balances */}
        <span className="flex flex-col items-start leading-none">
          <span className="text-white font-semibold text-xs">{shortAddr(address!)}</span>
          <span className="text-gray-400 text-[10px] mt-0.5">
            {solBalance.toFixed(3)} SOL · {usdcBalance.toFixed(2)} USDC
          </span>
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
            "absolute right-0 top-full mt-2 w-64 rounded-2xl z-50",
            "bg-[#161b27] border border-white/10 shadow-2xl",
            "animate-slide-up overflow-hidden"
          )}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-white/6">
            <p className="text-white font-semibold text-sm font-mono">{shortAddr(address!)}</p>
            <p className="text-gray-500 text-[10px] mt-0.5 font-mono truncate">{address}</p>

            {/* SOL / USDC balance row */}
            <div className="flex items-center gap-4 mt-2.5">
              <div>
                <p className="text-white text-sm font-bold">{solBalance.toFixed(4)}</p>
                <p className="text-gray-500 text-[10px]">SOL</p>
              </div>
              <div className="w-px h-6 bg-white/8" />
              <div>
                <p className="text-white text-sm font-bold">{usdcBalance.toFixed(2)}</p>
                <p className="text-gray-500 text-[10px]">USDC</p>
              </div>
            </div>
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
              icon={ExternalLink}
              label="View on Solscan"
              onClick={openSolscan}
            />
            <DropdownItem
              icon={LogOut}
              label="Disconnect"
              onClick={handleDisconnect}
              danger
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
