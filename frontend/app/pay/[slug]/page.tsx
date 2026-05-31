"use client";

/**
 * /pay/[slug] — Auron Pay Page
 *
 * Shareable payment request links. Anyone can send you money by
 * visiting your Auron pay link — no app download, no account needed.
 *
 * URL formats:
 *   /pay/rahul.sol               → pay rahul.sol any amount
 *   /pay/rahul.sol?amount=500    → pay ₹500 to rahul.sol
 *   /pay/rahul.sol?amount=500&note=Dinner
 *
 * The link can be shared on WhatsApp, Instagram bio, Twitter — anywhere.
 */

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, ExternalLink, ArrowRight, Wallet, Loader2, CheckCircle2 } from "lucide-react";
import AuronLogo from "@/components/AuronLogo";

// ─── Types ────────────────────────────────────────────────────────────────────

type PageState = "loading" | "ready" | "connecting" | "paying" | "done" | "error";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortAddr(addr: string) {
  if (addr.endsWith(".sol")) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PayPage() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();

  const amount = parseFloat(searchParams.get("amount") ?? "0") || null;
  const note = searchParams.get("note") ?? "";
  const currency = (searchParams.get("currency") ?? "INR").toUpperCase();

  const [state, setState] = useState<PageState>("loading");
  const [customAmount, setCustomAmount] = useState("");
  const [copied, setCopied] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Simulate address resolution (in prod this calls /api/resolve-recipient)
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>(slug ?? "");

  useEffect(() => {
    async function resolve() {
      setState("loading");
      try {
        const res = await fetch("/api/resolve-recipient", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recipient: slug }),
        });
        if (!res.ok) throw new Error("Could not resolve");
        const data = await res.json() as { address: string; display: string };
        setResolvedAddress(data.address);
        setDisplayName(data.display ?? slug);
        setState("ready");
      } catch {
        // If resolution fails, treat slug as wallet address directly
        setResolvedAddress(slug);
        setDisplayName(slug);
        setState("ready");
      }
    }
    if (slug) resolve();
  }, [slug]);

  const finalAmount = amount ?? (customAmount ? parseFloat(customAmount) : null);
  const displayAmount = finalAmount
    ? currency === "INR" ? `₹${finalAmount.toLocaleString("en-IN")}` : `${finalAmount} ${currency}`
    : null;

  function copyLink() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handlePayWithAuron() {
    // Deep link to Auron app with pre-filled payment
    const intent = finalAmount
      ? `Pay ${displayAmount} to ${displayName}${note ? ` for ${note}` : ""}`
      : `Pay ${displayName}`;
    const appUrl = `https://auron-mocha.vercel.app/app?intent=${encodeURIComponent(intent)}`;
    window.location.href = appUrl;
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: "radial-gradient(ellipse at top, #0f0a1a 0%, #080810 60%)" }}
    >
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px]"
          style={{ background: "radial-gradient(ellipse, rgba(201,168,76,0.08) 0%, transparent 70%)", filter: "blur(80px)" }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-sm"
      >
        {/* Header */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <AuronLogo size={26} showText textSize={12} />
        </div>

        {/* Card */}
        <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(201,168,76,0.15)" }}>

          <AnimatePresence mode="wait">
            {state === "loading" && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center py-8 gap-3">
                <Loader2 size={24} className="text-white/30 animate-spin" />
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>Resolving…</p>
              </motion.div>
            )}

            {state === "ready" && (
              <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="space-y-5">

                {/* Recipient */}
                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center text-2xl font-black"
                    style={{ background: "linear-gradient(135deg, rgba(201,168,76,0.15), rgba(201,168,76,0.05))", border: "1px solid rgba(201,168,76,0.25)" }}>
                    {displayName[0]?.toUpperCase() ?? "?"}
                  </div>
                  <p className="text-white font-bold text-lg">{displayName}</p>
                  {resolvedAddress && resolvedAddress !== displayName && (
                    <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--text-muted)" }}>
                      {shortAddr(resolvedAddress)}
                    </p>
                  )}
                  {note && <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>"{note}"</p>}
                </div>

                {/* Amount */}
                {amount ? (
                  <div className="text-center py-3 rounded-xl" style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.15)" }}>
                    <p className="text-3xl font-black" style={{ color: "var(--auron-gold)" }}>{displayAmount}</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>requested amount</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <label className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>Amount (₹)</label>
                    <input
                      type="number"
                      placeholder="Enter amount"
                      value={customAmount}
                      onChange={e => setCustomAmount(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-white text-center text-xl font-bold bg-white/5 border border-white/10 outline-none focus:border-yellow-500/50"
                    />
                  </div>
                )}

                {/* Pay button */}
                <motion.button
                  onClick={handlePayWithAuron}
                  disabled={!finalAmount && !customAmount}
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  className="w-full flex items-center justify-center gap-2 py-4 rounded-xl font-black text-sm text-[#080810] btn-gold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <AuronLogo size={16} />
                  Pay with Auron
                  <ArrowRight size={14} />
                </motion.button>

                {/* Share link */}
                <div className="flex items-center gap-2 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="flex-1 text-xs font-mono truncate" style={{ color: "var(--text-muted)" }}>
                    {typeof window !== "undefined" ? window.location.href : ""}
                  </p>
                  <button onClick={copyLink} className="shrink-0 p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                    {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} style={{ color: "var(--text-muted)" }} />}
                  </button>
                </div>

                <p className="text-center text-xs" style={{ color: "var(--text-muted)" }}>
                  Powered by Auron · Solana · No app needed
                </p>
              </motion.div>
            )}

            {state === "done" && (
              <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center py-8 gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                  <CheckCircle2 size={28} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-white font-bold text-lg">Payment sent!</p>
                  <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                    {displayAmount} sent to {displayName}
                  </p>
                </div>
                {txHash && (
                  <a href={`https://solscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs" style={{ color: "var(--auron-gold)" }}>
                    View on Solscan <ExternalLink size={12} />
                  </a>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Powered by */}
        <div className="flex items-center justify-center gap-2 mt-6">
          <Wallet size={12} style={{ color: "var(--text-muted)" }} />
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Payments settle on <span style={{ color: "var(--auron-gold)" }}>Solana</span> in &lt;1 second
          </p>
        </div>
      </motion.div>
    </div>
  );
}
