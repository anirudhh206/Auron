"use client";

import { useState, useRef, useEffect, type ElementType } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useQuery } from "@tanstack/react-query";
import { Wallet, ChevronDown, Copy, ExternalLink, Check, LogOut, X, ArrowRight, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { shortAddr, getSOLBalance, getUSDCBalance } from "@/lib/solana";
import {
  buildPhantomConnectUrl,
  parsePhantomConnectResponse,
  storeConnectedWallet,
  getStoredWallet,
  clearStoredWallet,
} from "@/lib/phantomMobile";

// ─── Environment detection ────────────────────────────────────────────────────

function useWalletEnv() {
  const [env, setEnv] = useState<"desktop" | "phantom-browser" | "mobile-pwa" | "mobile-browser">("desktop");

  useEffect(() => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isPhantomBrowser = !!(window as any).phantom?.solana;
    const isPWA = window.matchMedia("(display-mode: standalone)").matches;

    if (isPhantomBrowser) setEnv("phantom-browser");
    else if (isMobile && isPWA) setEnv("mobile-pwa");
    else if (isMobile) setEnv("mobile-browser");
    else setEnv("desktop");
  }, []);

  return env;
}

// ─── Phantom response handler — runs on every page load ──────────────────────

function usePhantomDeepLinkResponse(onConnected: (pubKey: string) => void) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const result = parsePhantomConnectResponse(params);
    if (!result) return;

    // Clean URL params — don't leave keys in the address bar
    const clean = window.location.pathname;
    window.history.replaceState({}, "", clean);

    storeConnectedWallet(result.publicKey);
    onConnected(result.publicKey);
  }, [onConnected]);
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WalletWidget() {
  const { publicKey, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const env = useWalletEnv();

  // For mobile deep-link connections (bypasses wallet adapter)
  const [mobileWallet, setMobileWallet] = useState<string | null>(null);
  const [showMobileModal, setShowMobileModal] = useState(false);

  // On mount: restore previously connected mobile wallet
  useEffect(() => {
    const stored = getStoredWallet();
    if (stored) setMobileWallet(stored);
  }, []);

  // Handle Phantom deep link redirect response
  usePhantomDeepLinkResponse((pubKey) => setMobileWallet(pubKey));

  const address = publicKey?.toString() ?? mobileWallet ?? null;
  const isConnected = connected || !!mobileWallet;

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
    clearStoredWallet();
    setMobileWallet(null);
    if (connected) await disconnect();
  }

  function handlePhantomDeepLink() {
    // Build deep link with encrypted keypair stored in sessionStorage
    const url = buildPhantomConnectUrl();
    // Use location.href (not window.open) — required for deep links to work in PWA
    window.location.href = url;
  }

  // ── Not connected ──────────────────────────────────────────────────────────
  if (!isConnected) {
    // In Phantom's browser: injected provider works, use normal modal
    if (env === "phantom-browser" || env === "desktop") {
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

    // Mobile (PWA or browser): show modal explaining the flow
    return (
      <>
        <button
          onClick={() => setShowMobileModal(true)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold",
            "bg-violet-600 hover:bg-violet-500 text-white",
            "transition-all duration-150 active:scale-95"
          )}
        >
          <Wallet size={15} />
          Connect Wallet
        </button>

        {showMobileModal && (
          <PhantomMobileModal
            onClose={() => setShowMobileModal(false)}
            onDeepLink={handlePhantomDeepLink}
          />
        )}
      </>
    );
  }

  // ── Connected ──────────────────────────────────────────────────────────────
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
        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
        <span className="flex flex-col items-start leading-none">
          <span className="text-white font-semibold text-xs">{shortAddr(address!)}</span>
          <span className="text-gray-400 text-[10px] mt-0.5">
            {solBalance.toFixed(3)} SOL · {usdcBalance.toFixed(2)} USDC
          </span>
        </span>
        <ChevronDown
          size={14}
          className={cn("text-gray-400 transition-transform duration-150", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className={cn(
          "absolute right-0 top-full mt-2 w-64 rounded-2xl z-50",
          "bg-[#161b27] border border-white/10 shadow-2xl",
          "animate-slide-up overflow-hidden"
        )}>
          <div className="px-4 py-3 border-b border-white/6">
            <p className="text-white font-semibold text-sm font-mono">{shortAddr(address!)}</p>
            <p className="text-gray-500 text-[10px] mt-0.5 font-mono truncate">{address}</p>
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

          <div className="p-2 space-y-0.5">
            <DropdownItem icon={copied ? Check : Copy} label={copied ? "Copied!" : "Copy address"} onClick={copyAddress} accent={copied} />
            <DropdownItem icon={ExternalLink} label="View on Solscan" onClick={openSolscan} />
            <DropdownItem icon={LogOut} label="Disconnect" onClick={handleDisconnect} danger />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Phantom Mobile Modal ─────────────────────────────────────────────────────

function PhantomMobileModal({
  onClose,
  onDeepLink,
}: {
  onClose: () => void;
  onDeepLink: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{
          background: "#0F1117",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
              <Smartphone size={18} className="text-violet-400" />
            </div>
            <div>
              <p className="text-white font-bold text-sm">Connect Phantom</p>
              <p className="text-white/40 text-xs">Mobile wallet connection</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors p-1">
            <X size={16} />
          </button>
        </div>

        {/* Steps */}
        <div className="space-y-3 mb-6">
          {[
            { n: "1", text: "Tap Connect below — Phantom will open" },
            { n: "2", text: "Approve the connection in Phantom" },
            { n: "3", text: "You'll return here automatically" },
          ].map(({ n, text }) => (
            <div key={n} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-violet-500/20 text-violet-400 text-xs font-bold flex items-center justify-center shrink-0">
                {n}
              </span>
              <span className="text-white/60 text-sm">{text}</span>
            </div>
          ))}
        </div>

        {/* Connect button */}
        <button
          onClick={onDeepLink}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm text-white transition-all active:scale-95"
          style={{ background: "linear-gradient(135deg, #9945FF, #7c3aed)" }}
        >
          <Wallet size={16} />
          Connect with Phantom
          <ArrowRight size={14} />
        </button>

        <p className="text-center text-white/25 text-xs mt-3">
          Phantom must be installed on your device
        </p>
      </div>
    </div>
  );
}

// ─── Dropdown item ────────────────────────────────────────────────────────────

function DropdownItem({
  icon: Icon, label, onClick, accent = false, danger = false,
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
