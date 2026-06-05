"use client";

import { useState, useRef, useEffect, type ElementType } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useQuery } from "@tanstack/react-query";
import { Wallet, ChevronDown, Copy, ExternalLink, Check, LogOut, X, ArrowRight, Smartphone } from "lucide-react";
import { shortAddr, getSOLBalance, getUSDCBalance } from "@/lib/solana";
import { buildPhantomConnectUrl, parsePhantomConnectResponse, storeConnectedWallet, getStoredWallet, clearStoredWallet } from "@/lib/phantomMobile";

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
  usdc:   "#2775CA",
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');

  .ww-connect-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: 10px;
    background: ${C.lime};
    border: none;
    font-family: 'Geist', sans-serif;
    font-size: 13px;
    font-weight: 700;
    color: #0A0A08;
    cursor: pointer;
    transition: background 0.15s, transform 0.1s;
  }
  .ww-connect-btn:hover { background: #A3C42A; }
  .ww-connect-btn:active { transform: scale(0.97); }

  .ww-wallet-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 12px;
    border-radius: 10px;
    background: ${C.s1};
    border: 1px solid ${C.border};
    cursor: pointer;
    transition: border-color 0.15s;
  }
  .ww-wallet-btn:hover { border-color: ${C.borderB}; }

  .ww-dropdown {
    position: absolute;
    right: 0;
    top: calc(100% + 8px);
    width: 240px;
    border-radius: 14px;
    background: ${C.s1};
    border: 1px solid ${C.border};
    overflow: hidden;
    box-shadow: 0 16px 48px rgba(0,0,0,0.5);
    z-index: 50;
  }

  .ww-dropdown-header {
    padding: 14px 16px;
    border-bottom: 0.5px solid ${C.border};
  }

  .ww-dropdown-items {
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .ww-dropdown-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    border-radius: 10px;
    background: transparent;
    border: none;
    font-family: 'Geist', sans-serif;
    font-size: 13px;
    cursor: pointer;
    text-align: left;
    transition: background 0.12s;
  }
  .ww-dropdown-item:hover { background: ${C.s2}; }
  .ww-dropdown-item-danger { color: #EF4444; }
  .ww-dropdown-item-accent { color: ${C.lime}; }
  .ww-dropdown-item-default { color: ${C.muted}; }

  /* Mobile modal */
  .ww-mobile-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: rgba(0,0,0,0.75);
    backdrop-filter: blur(8px);
  }
  .ww-mobile-sheet {
    width: 100%;
    max-width: 390px;
    background: ${C.s1};
    border-radius: 20px 20px 0 0;
    border-top: 0.5px solid ${C.border};
    padding: 24px 20px 32px;
    font-family: 'Geist', sans-serif;
  }
  .ww-phantom-btn {
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
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: background 0.15s;
  }
  .ww-phantom-btn:hover { background: #A3C42A; }
`;

function useWalletEnv() {
  const [env, setEnv] = useState<"desktop" | "phantom-browser" | "mobile-pwa" | "mobile-browser">("desktop");
  useEffect(() => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const isPhantomBrowser = !!(window as Window & { phantom?: { solana?: unknown } }).phantom?.solana;
    const isPWA = window.matchMedia("(display-mode: standalone)").matches;
    if (isPhantomBrowser) setEnv("phantom-browser");
    else if (isMobile && isPWA) setEnv("mobile-pwa");
    else if (isMobile) setEnv("mobile-browser");
    else setEnv("desktop");
  }, []);
  return env;
}

function usePhantomDeepLinkResponse(onConnected: (pubKey: string) => void) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const result = parsePhantomConnectResponse(params);
    if (!result) return;
    window.history.replaceState({}, "", window.location.pathname);
    storeConnectedWallet(result.publicKey);
    onConnected(result.publicKey);
  }, [onConnected]);
}

export default function WalletWidget() {
  const { publicKey, connected, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const env = useWalletEnv();

  const [mobileWallet, setMobileWallet] = useState<string | null>(null);
  const [showMobileModal, setShowMobileModal] = useState(false);

  useEffect(() => {
    const stored = getStoredWallet();
    if (stored) setMobileWallet(stored);
  }, []);

  usePhantomDeepLinkResponse((pubKey) => setMobileWallet(pubKey));

  const address = publicKey?.toString() ?? mobileWallet ?? null;
  const isConnected = connected || !!mobileWallet;

  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: solBalance = 0 } = useQuery({
    queryKey: ["sol-balance", address],
    queryFn: () => getSOLBalance(address!),
    enabled: !!address, refetchInterval: 30_000, staleTime: 15_000,
  });
  const { data: usdcBalance = 0 } = useQuery({
    queryKey: ["usdc-balance", address],
    queryFn: () => getUSDCBalance(address!),
    enabled: !!address, refetchInterval: 30_000, staleTime: 15_000,
  });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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
    window.location.href = buildPhantomConnectUrl();
  }

  if (!isConnected) {
    if (env === "phantom-browser" || env === "desktop") {
      return (
        <>
          <style>{STYLES}</style>
          <button className="ww-connect-btn" onClick={() => setVisible(true)}>
            <Wallet size={14} />
            Connect Wallet
          </button>
        </>
      );
    }
    return (
      <>
        <style>{STYLES}</style>
        <button className="ww-connect-btn" onClick={() => setShowMobileModal(true)}>
          <Wallet size={14} />
          Connect Wallet
        </button>
        {showMobileModal && (
          <PhantomMobileModal onClose={() => setShowMobileModal(false)} onDeepLink={handlePhantomDeepLink} />
        )}
      </>
    );
  }

  return (
    <>
      <style>{STYLES}</style>
      <div ref={ref} style={{ position: "relative" }}>
        <button className="ww-wallet-btn" onClick={() => setOpen((v) => !v)}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.lime, flexShrink: 0 }} />
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
            <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 12, fontWeight: 600, color: C.text }}>{shortAddr(address!)}</span>
            <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 9, color: C.dim }}>
              {solBalance.toFixed(3)} SOL · {usdcBalance.toFixed(2)} USDC
            </span>
          </span>
          <ChevronDown size={13} color={C.dim} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
        </button>

        {open && (
          <div className="ww-dropdown">
            <div className="ww-dropdown-header">
              <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 12, fontWeight: 600, color: C.text, margin: "0 0 2px" }}>{shortAddr(address!)}</p>
              <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 9, color: C.dim, margin: "0 0 10px", overflow: "hidden", textOverflow: "ellipsis" }}>{address}</p>
              <div style={{ display: "flex", gap: 20 }}>
                <div>
                  <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>{solBalance.toFixed(4)}</p>
                  <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 9, color: C.dim, margin: 0 }}>SOL</p>
                </div>
                <div style={{ width: 1, background: C.border }} />
                <div>
                  <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 13, fontWeight: 600, color: C.usdc, margin: 0 }}>{usdcBalance.toFixed(2)}</p>
                  <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 9, color: C.dim, margin: 0 }}>USDC</p>
                </div>
              </div>
            </div>
            <div className="ww-dropdown-items">
              <WalletDropdownItem icon={copied ? Check : Copy} label={copied ? "Copied!" : "Copy address"} onClick={copyAddress} accent={copied} />
              <WalletDropdownItem icon={ExternalLink} label="View on Solscan" onClick={openSolscan} />
              <WalletDropdownItem icon={LogOut} label="Disconnect" onClick={handleDisconnect} danger />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function PhantomMobileModal({ onClose, onDeepLink }: { onClose: () => void; onDeepLink: () => void }) {
  return (
    <>
      <style>{STYLES}</style>
      <div className="ww-mobile-overlay" onClick={onClose}>
        <div className="ww-mobile-sheet" onClick={(e) => e.stopPropagation()}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(200,241,53,0.08)", border: "1px solid rgba(200,241,53,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Smartphone size={18} color={C.lime} />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>Connect Phantom</p>
                <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, margin: "2px 0 0" }}>Mobile wallet connection</p>
              </div>
            </div>
            <button onClick={onClose} style={{ padding: 6, background: "none", border: "none", cursor: "pointer", color: C.dim }}>
              <X size={15} />
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
            {[
              { n: "1", text: "Tap Connect — Phantom will open" },
              { n: "2", text: "Approve the connection in Phantom" },
              { n: "3", text: "You'll return here automatically" },
            ].map(({ n, text }) => (
              <div key={n} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(200,241,53,0.08)", border: "1px solid rgba(200,241,53,0.15)", fontSize: 11, fontWeight: 700, color: C.lime, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {n}
                </span>
                <span style={{ fontSize: 13, color: C.muted }}>{text}</span>
              </div>
            ))}
          </div>

          <button className="ww-phantom-btn" onClick={onDeepLink}>
            <Wallet size={15} />
            Connect with Phantom
            <ArrowRight size={14} />
          </button>
          <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, textAlign: "center", marginTop: 12 }}>
            Phantom must be installed on your device
          </p>
        </div>
      </div>
    </>
  );
}

function WalletDropdownItem({ icon: Icon, label, onClick, accent = false, danger = false }: {
  readonly icon: ElementType; readonly label: string; readonly onClick: () => void;
  readonly accent?: boolean; readonly danger?: boolean;
}) {
  const color = danger ? "#EF4444" : accent ? C.lime : C.muted;
  return (
    <button type="button" onClick={onClick} className={`ww-dropdown-item ${danger ? "ww-dropdown-item-danger" : accent ? "ww-dropdown-item-accent" : "ww-dropdown-item-default"}`}>
      <Icon size={14} color={color} style={{ flexShrink: 0 }} />
      <span style={{ color }}>{label}</span>
    </button>
  );
}
