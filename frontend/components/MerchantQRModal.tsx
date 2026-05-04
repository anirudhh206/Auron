"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import QRCode from "react-qr-code";
import { X, Copy, CheckCircle2, Zap, Share2, ExternalLink } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { USDC_MINT, shortAddr } from "@/lib/solana";
import type { User } from "@supabase/supabase-js";

// ─── Props ─────────────────────────────────────────────────────────────────────
interface MerchantQRModalProps {
  onClose: () => void;
  user: User | null;
}

// ─── Solana Pay URL builder ────────────────────────────────────────────────────
function buildSolanaPayUrl(address: string, label: string): string {
  const params = new URLSearchParams({
    "spl-token": USDC_MINT.toString(),
    label: label,
    message: "Auron Payment",
  });
  return `solana:${address}?${params.toString()}`;
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function MerchantQRModal({ onClose, user }: MerchantQRModalProps) {
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const address = publicKey?.toString() ?? null;

  const [copied, setCopied] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const displayName =
    user?.user_metadata?.full_name ??
    user?.email?.split("@")[0] ??
    "Auron User";

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
      await navigator.share({
        title: `Pay ${displayName} via Auron`,
        text: `Send USDC instantly to ${displayName} using Auron`,
        url: solanaPayUrl,
      }).catch(() => {});
    } else {
      await handleCopyUrl();
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        className="w-full max-w-sm"
        style={{
          background: "#0A0A0F",
          border: "1px solid rgba(201,168,76,0.15)",
          borderBottom: "none",
          borderRadius: "24px 24px 0 0",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-5 pt-5 pb-4"
          style={{ borderBottom: "1px solid rgba(201,168,76,0.1)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl btn-gold flex items-center justify-center shrink-0">
              <Zap size={14} fill="currentColor" className="text-[#0A0A0F]" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold text-white">My Auron QR</p>
              <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                Receive USDC from any Auron user
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "var(--text-muted)",
            }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div className="flex flex-col items-center px-5 py-6 gap-4">

          {address && solanaPayUrl ? (
            <>
              {/* QR Code block */}
              <div
                className="relative rounded-2xl p-5 w-full flex flex-col items-center"
                style={{
                  background: "rgba(201,168,76,0.06)",
                  border: "1px solid rgba(201,168,76,0.18)",
                }}
              >
                {/* User label */}
                <p
                  className="text-xs font-semibold mb-4 tracking-wide"
                  style={{ color: "rgba(201,168,76,0.75)" }}
                >
                  {displayName.toUpperCase()}
                </p>

                {/* QR + Auron badge */}
                <div className="relative rounded-xl overflow-hidden" style={{ padding: "16px", background: "#ffffff" }}>
                  <QRCode
                    value={solanaPayUrl}
                    size={196}
                    style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                    viewBox="0 0 256 256"
                    level="H"
                  />
                  {/* Center logo — within QR error-correction headroom */}
                  <div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  >
                    <div
                      className="w-9 h-9 rounded-xl btn-gold flex items-center justify-center"
                      style={{ boxShadow: "0 0 0 4px #ffffff" }}
                    >
                      <Zap size={15} fill="currentColor" className="text-[#0A0A0F]" />
                    </div>
                  </div>
                </div>

                {/* Token badge */}
                <div
                  className="mt-4 flex items-center gap-2 rounded-full px-3 py-1.5"
                  style={{
                    background: "rgba(201,168,76,0.1)",
                    border: "1px solid rgba(201,168,76,0.22)",
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] font-semibold" style={{ color: "#C9A84C" }}>
                    USDC · Solana · Instant
                  </span>
                </div>
              </div>

              {/* Address copy row */}
              <button
                onClick={handleCopyAddress}
                className="flex items-center gap-3 w-full rounded-xl px-4 py-3 transition-all group"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
                aria-label="Copy wallet address"
              >
                <span
                  className="flex-1 text-left font-mono truncate"
                  style={{ fontSize: "11px", color: "var(--text-secondary)" }}
                >
                  {address}
                </span>
                <AnimatePresence mode="wait">
                  {copied ? (
                    <motion.div
                      key="check"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="copy"
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.5, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <Copy size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>

              {/* Info row */}
              <div
                className="w-full rounded-xl px-4 py-3"
                style={{
                  background: "rgba(201,168,76,0.05)",
                  border: "1px solid rgba(201,168,76,0.12)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p
                      className="text-[10px] font-semibold uppercase tracking-widest mb-1"
                      style={{ color: "rgba(201,168,76,0.55)" }}
                    >
                      Accepts
                    </p>
                    <p className="text-sm font-bold text-white">USDC on Solana</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                      Any Auron user can scan &amp; pay you instantly
                    </p>
                  </div>
                  <ExternalLink size={13} style={{ color: "rgba(201,168,76,0.4)", marginTop: "2px", flexShrink: 0 }} />
                </div>
              </div>

              {/* Share button */}
              <motion.button
                onClick={handleShare}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center justify-center gap-2 w-full rounded-xl py-3 text-sm font-bold transition-all"
                style={{
                  background: "rgba(201,168,76,0.1)",
                  border: "1px solid rgba(201,168,76,0.25)",
                  color: "#C9A84C",
                }}
              >
                {copiedUrl ? (
                  <>
                    <CheckCircle2 size={15} className="text-emerald-400" />
                    <span className="text-emerald-400">Link copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 size={15} />
                    Share Pay Link
                  </>
                )}
              </motion.button>
            </>
          ) : (
            /* ── No wallet connected ──────────────────────────────────── */
            <div className="w-full py-8 flex flex-col items-center gap-4 text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{
                  background: "rgba(201,168,76,0.07)",
                  border: "1px solid rgba(201,168,76,0.18)",
                }}
              >
                <Zap size={26} style={{ color: "rgba(201,168,76,0.5)" }} />
              </div>
              <div>
                <p className="text-sm font-semibold text-white mb-1">
                  Connect Phantom to generate your QR
                </p>
                <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                  Your Solana wallet address becomes your payment QR
                </p>
              </div>
              <motion.button
                onClick={() => { setVisible(true); onClose(); }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-bold btn-gold text-[#0A0A0F]"
              >
                Connect Phantom
              </motion.button>
            </div>
          )}
        </div>

        {/* Safe-area bottom spacing */}
        <div style={{ height: "max(20px, env(safe-area-inset-bottom))" }} />
      </motion.div>
    </motion.div>
  );
}
