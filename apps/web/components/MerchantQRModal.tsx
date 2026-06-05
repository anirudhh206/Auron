"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "react-qr-code";
import { X, Copy, CheckCircle2, Share2 } from "lucide-react";
import AuronLogo from "@/components/AuronLogo";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { USDC_MINT } from "@/lib/solana";
import type { User } from "@supabase/supabase-js";

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
};

interface MerchantQRModalProps {
  onClose: () => void;
  user: User | null;
}

function buildSolanaPayUrl(address: string, label: string): string {
  const params = new URLSearchParams({
    "spl-token": USDC_MINT.toString(),
    label,
    message: "Auron Payment",
  });
  return `solana:${address}?${params.toString()}`;
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');

  .mqr-overlay {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    background: rgba(0,0,0,0.75);
    backdrop-filter: blur(8px);
  }

  .mqr-sheet {
    width: 100%;
    max-width: 390px;
    background: ${C.s1};
    border-radius: 20px 20px 0 0;
    border-top: 0.5px solid ${C.border};
    font-family: 'Geist', sans-serif;
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
  }

  .mqr-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px;
    border-bottom: 0.5px solid ${C.border};
  }

  .mqr-close {
    width: 30px; height: 30px;
    border-radius: 8px;
    background: ${C.s2};
    border: 1px solid ${C.border};
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    color: ${C.dim};
    transition: border-color 0.15s, color 0.15s;
  }
  .mqr-close:hover { border-color: ${C.borderB}; color: ${C.muted}; }

  .mqr-body {
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
  }

  .mqr-qr-block {
    width: 100%;
    border-radius: 14px;
    padding: 20px;
    background: rgba(200,241,53,0.03);
    border: 1px solid rgba(200,241,53,0.12);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
  }

  .mqr-qr-wrap {
    border-radius: 12px;
    padding: 14px;
    background: #ffffff;
    position: relative;
  }

  .mqr-token-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    border-radius: 100px;
    background: rgba(200,241,53,0.08);
    border: 1px solid rgba(200,241,53,0.18);
  }

  .mqr-live-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: ${C.lime};
    animation: pulseDot 2s ease-in-out infinite;
  }
  @keyframes pulseDot {
    0%,100% { opacity:1; }
    50% { opacity:0.3; }
  }

  .mqr-addr-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 14px;
    background: ${C.s2};
    border: 1px solid ${C.border};
    border-radius: 10px;
    cursor: pointer;
    transition: border-color 0.15s;
  }
  .mqr-addr-row:hover { border-color: ${C.borderB}; }

  .mqr-info {
    width: 100%;
    padding: 12px 14px;
    border-radius: 10px;
    background: rgba(200,241,53,0.03);
    border: 1px solid rgba(200,241,53,0.1);
  }

  .mqr-share {
    width: 100%;
    padding: 13px;
    border-radius: 12px;
    background: ${C.s2};
    border: 1px solid ${C.border};
    font-family: 'Geist', sans-serif;
    font-size: 14px;
    font-weight: 600;
    color: ${C.lime};
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: border-color 0.15s, background 0.15s;
  }
  .mqr-share:hover { border-color: rgba(200,241,53,0.3); background: rgba(200,241,53,0.04); }

  .mqr-connect-btn {
    padding: 12px 24px;
    border-radius: 12px;
    background: ${C.lime};
    border: none;
    font-family: 'Geist', sans-serif;
    font-size: 14px;
    font-weight: 700;
    color: #0A0A08;
    cursor: pointer;
    transition: background 0.15s;
  }
  .mqr-connect-btn:hover { background: #A3C42A; }
`;

export default function MerchantQRModal({ onClose, user }: MerchantQRModalProps) {
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const address = publicKey?.toString() ?? null;

  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const displayName = user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "Auron User";
  const solanaPayUrl = address ? buildSolanaPayUrl(address, displayName) : null;

  async function handleCopyAddress() {
    if (!address) return;
    await navigator.clipboard.writeText(address).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCopyUrl() {
    if (!solanaPayUrl) return;
    await navigator.clipboard.writeText(solanaPayUrl).catch(() => {});
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  }

  async function handleShare() {
    if (!solanaPayUrl) return;
    if ("share" in navigator) {
      await navigator.share({ title: `Pay ${displayName} via Auron`, text: `Send USDC instantly to ${displayName}`, url: solanaPayUrl }).catch(() => {});
    } else {
      await handleCopyUrl();
    }
  }

  return (
    <>
      <style>{STYLES}</style>
      <motion.div className="mqr-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <motion.div
          className="mqr-sheet"
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "spring", stiffness: 380, damping: 38 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mqr-header">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <AuronLogo size={26} />
              <div>
                <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: 0 }}>My Auron QR</p>
                <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, margin: "2px 0 0" }}>
                  Receive USDC from any Auron user
                </p>
              </div>
            </div>
            <button className="mqr-close" onClick={onClose} aria-label="Close"><X size={14} /></button>
          </div>

          <div className="mqr-body">
            {address && solanaPayUrl ? (
              <>
                <div className="mqr-qr-block">
                  <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, letterSpacing: "0.1em" }}>
                    {displayName.toUpperCase()}
                  </p>
                  <div className="mqr-qr-wrap">
                    <QRCode value={solanaPayUrl} size={188} level="H" style={{ height: "auto", maxWidth: "100%", width: "100%" }} viewBox="0 0 256 256" />
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                      <div style={{ background: C.bg, borderRadius: 10, padding: 4, boxShadow: `0 0 0 3px #fff` }}>
                        <AuronLogo size={26} />
                      </div>
                    </div>
                  </div>
                  <div className="mqr-token-badge">
                    <span className="mqr-live-dot" />
                    <span style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, fontWeight: 500, color: C.lime }}>
                      USDC · Solana · Instant
                    </span>
                  </div>
                </div>

                <button className="mqr-addr-row" onClick={handleCopyAddress}>
                  <span style={{ flex: 1, fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.dim, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {address}
                  </span>
                  <AnimatePresence mode="wait">
                    {copied
                      ? <motion.div key="c" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><CheckCircle2 size={14} color={C.lime} /></motion.div>
                      : <motion.div key="u" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Copy size={13} color={C.dim} /></motion.div>}
                  </AnimatePresence>
                </button>

                <div className="mqr-info">
                  <p style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: "0 0 4px" }}>Accepts USDC on Solana</p>
                  <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, margin: 0 }}>
                    Any Auron user can scan & pay you instantly
                  </p>
                </div>

                <button className="mqr-share" onClick={handleShare}>
                  {copiedUrl ? (
                    <><CheckCircle2 size={14} color={C.lime} /><span style={{ color: C.lime }}>Link copied!</span></>
                  ) : (
                    <><Share2 size={14} />Share Pay Link</>
                  )}
                </button>
              </>
            ) : (
              <div style={{ padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, textAlign: "center" }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: C.s2, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <AuronLogo size={32} />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: C.text, margin: "0 0 6px" }}>Connect wallet to generate your QR</p>
                  <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, margin: 0 }}>
                    Your Solana wallet address becomes your payment QR
                  </p>
                </div>
                <button className="mqr-connect-btn" onClick={() => { setVisible(true); onClose(); }}>
                  Connect Phantom
                </button>
              </div>
            )}
          </div>
          <div style={{ height: "max(20px, env(safe-area-inset-bottom))" }} />
        </motion.div>
      </motion.div>
    </>
  );
}
