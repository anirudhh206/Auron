"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/store/useStore";
import { createClient } from "@/lib/supabase/client";
import { getSOLBalance, getUSDCBalance, shortAddr } from "@/lib/solana";
import WalletWidget from "@/components/WalletWidget";
import ChatInterface, { type ChatInterfaceHandle } from "@/components/ChatInterface";
import TransactionHistory from "@/components/TransactionHistory";
import OnboardingFlow from "@/components/OnboardingFlow";
import MerchantQRModal from "@/components/MerchantQRModal";
import NetworkMismatchBanner from "@/components/NetworkMismatchBanner";
import { usePhantomDeepLink } from "@/hooks/usePhantomDeepLink";
import {
  Zap, QrCode, MessageSquare, History, LogOut, Send,
  Lock, FileText, ShieldCheck, Wallet, ArrowRight, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";

type MobileTab = "scan" | "chat";

// ─────────────────────────────────────────────────────────────────────────────
export default function AppPage() {
  const { publicKey, connected: walletConnected } = useWallet();
  const { setVisible } = useWalletModal();
  const deepLink = usePhantomDeepLink();

  // Merge desktop wallet-adapter + mobile deep-link session
  const isConnected = walletConnected || deepLink.isConnected;
  const address = publicKey?.toString() ?? deepLink.publicKey ?? null;

  const { setAddress, prefs } = useStore();

  const [showHistory, setShowHistory] = useState(false);
  const [showMyQR, setShowMyQR] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("scan");
  const [supabaseUser, setSupabaseUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const chatRef = useRef<ChatInterfaceHandle>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => { setAddress(address ?? null); }, [address, setAddress]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setSupabaseUser(user);
      setAuthLoading(false);
      if (!user) router.push("/login");
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSupabaseUser(s?.user ?? null);
      if (!s?.user) router.push("/login");
    });
    return () => subscription.unsubscribe();
  }, [router, supabase.auth]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  // Mobile: Scan tab button → switch to chat + open QR scanner
  function handleMobileScan() {
    setMobileTab("chat");
    setTimeout(() => chatRef.current?.openQRScanner(), 80);
  }

  // Mobile: Quick action chip → switch to chat + pre-fill
  function handleQuickAction(text: string) {
    setMobileTab("chat");
    setTimeout(() => chatRef.current?.submitMessage(text), 80);
  }

  // ─── Loading ────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-base)" }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-xl btn-gold flex items-center justify-center animate-pulse">
            <Zap size={18} fill="currentColor" className="text-[#0A0A0F]" />
          </div>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>Loading Auron...</p>
        </div>
      </div>
    );
  }

  if (!supabaseUser) return null;
  if (!prefs.hasOnboarded) return <OnboardingFlow />;

  // ─── Shared background ────────────────────────────────────────────────────
  const Aurora = () => (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(201,168,76,0.09) 0%, transparent 70%)", filter: "blur(60px)" }} />
      <div className="absolute -bottom-40 -right-20 w-[700px] h-[700px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%)", filter: "blur(80px)" }} />
      <div className="absolute inset-0 opacity-[0.02]"
        style={{ backgroundImage: "linear-gradient(rgba(201,168,76,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.5) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
    </div>
  );

  return (
    <div className="relative noise" style={{ background: "var(--bg-base)" }}>
      <Aurora />

      {/* ═══════════════════════════════════════════════════════════════
          DESKTOP / TABLET LAYOUT  (md and above — 768px+)
          ═══════════════════════════════════════════════════════════════ */}
      <div className="hidden md:flex flex-col h-screen overflow-hidden">
        {/* Desktop header */}
        <motion.header
          initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-20 flex items-center justify-between px-8 py-4 glass-strong"
          style={{ borderBottom: "1px solid rgba(201,168,76,0.1)" }}
        >
          <Link href="/" className="flex items-center gap-3">
            <motion.div whileHover={{ scale: 1.05, rotate: -5 }} transition={{ type: "spring", stiffness: 400 }}
              className="w-9 h-9 rounded-xl btn-gold flex items-center justify-center">
              <Zap size={17} fill="currentColor" className="text-[#0A0A0F]" />
            </motion.div>
            <div className="leading-none">
              <span className="font-display font-bold text-lg gradient-text-gold">AURON</span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {supabaseUser && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
                style={{ background: "rgba(201,168,76,0.06)", border: "1px solid rgba(201,168,76,0.12)", color: "var(--text-secondary)" }}>
                {supabaseUser.user_metadata?.avatar_url
                  ? <img src={supabaseUser.user_metadata.avatar_url} alt="" className="w-5 h-5 rounded-full" />
                  : <div className="w-5 h-5 rounded-full btn-gold flex items-center justify-center text-[9px] font-bold text-[#0A0A0F]">
                      {(supabaseUser.email ?? "A")[0].toUpperCase()}
                    </div>
                }
                <span>{supabaseUser.user_metadata?.full_name ?? supabaseUser.email?.split("@")[0]}</span>
              </div>
            )}
            <button onClick={() => setShowMyQR(true)}
              aria-label="My QR code — receive USDC"
              className="p-2.5 rounded-xl transition-all duration-150 hover:text-[#C9A84C]"
              style={{ color: "var(--text-secondary)" }}>
              <QrCode size={17} />
            </button>
            <button onClick={() => setShowHistory(true)}
              aria-label="Transaction history"
              className="p-2.5 rounded-xl transition-all duration-150 hover:text-white"
              style={{ color: "var(--text-secondary)" }}>
              <History size={17} />
            </button>
            {isConnected ? <WalletWidget /> : (
              <button onClick={handleSignOut}
                aria-label="Sign out"
                className="p-2.5 rounded-xl transition-all duration-150 hover:text-red-400"
                style={{ color: "var(--text-muted)" }}>
                <LogOut size={17} />
              </button>
            )}
          </div>
        </motion.header>

        {/* Network mismatch warning */}
        <div className="relative z-10 max-w-2xl mx-auto px-4 pt-2">
          <NetworkMismatchBanner />
        </div>

        {/* Desktop: full chat */}
        <main className="relative z-10 flex-1 overflow-hidden">
          <div className="h-full max-w-2xl mx-auto">
            <ChatInterface ref={chatRef} />
          </div>
        </main>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          MOBILE LAYOUT  (below md — under 768px) — scan-first, bottom nav
          ═══════════════════════════════════════════════════════════════ */}
      <div className="md:hidden flex flex-col" style={{ height: "100dvh" }}>

        {/* Mobile header — compact */}
        <motion.header
          initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="relative z-20 flex items-center justify-between px-5 py-3 glass-strong shrink-0"
          style={{ borderBottom: "1px solid rgba(201,168,76,0.1)" }}
        >
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl btn-gold flex items-center justify-center">
              <Zap size={15} fill="currentColor" className="text-[#0A0A0F]" />
            </div>
            <span className="font-display font-bold text-base gradient-text-gold tracking-wide">AURON</span>
          </Link>

          <div className="flex items-center gap-2">
            <button onClick={() => setShowHistory(true)}
              aria-label="Transaction history"
              className="p-2 rounded-xl" style={{ color: "var(--text-muted)" }}>
              <History size={16} />
            </button>
            {walletConnected ? (
              <WalletWidget />
            ) : deepLink.isConnected && address ? (
              /* Mobile deep-link session pill */
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
                style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span style={{ fontSize: "11px", fontWeight: 600, color: "#10b981", fontFamily: "monospace" }}>
                  {shortAddr(address)}
                </span>
                <button
                  onClick={() => { deepLink.disconnect(); }}
                  className="ml-1 opacity-50 hover:opacity-100 transition-opacity"
                  title="Disconnect"
                >
                  <LogOut size={12} style={{ color: "#10b981" }} />
                </button>
              </div>
            ) : (
              <button onClick={handleSignOut} aria-label="Sign out" className="p-2 rounded-xl" style={{ color: "var(--text-muted)" }}>
                <LogOut size={16} />
              </button>
            )}
          </div>
        </motion.header>

        {/* Tab content area */}
        <div className="relative z-10 flex-1 overflow-hidden">

          {/* Scan tab */}
          <div className={mobileTab === "scan" ? "h-full" : "hidden"}>
            <MobileScanHome
              address={address}
              isConnected={isConnected}
              user={supabaseUser}
              onScan={handleMobileScan}
              onMyQR={() => setShowMyQR(true)}
              onQuickAction={handleQuickAction}
              onSignOut={handleSignOut}
              onConnect={() =>
                deepLink.isMobileDevice && !deepLink.isInPhantomBrowser
                  ? deepLink.connect()
                  : setVisible(true)
              }
            />
          </div>

          {/* Chat tab — always mounted so ref works */}
          <div className={mobileTab === "chat" ? "h-full" : "hidden"} style={{ height: "100%" }}>
            <ChatInterface ref={chatRef} />
          </div>
        </div>

        {/* Bottom nav */}
        <MobileBottomNav tab={mobileTab} setTab={setMobileTab} />
      </div>

      {/* History drawer — both layouts */}
      <AnimatePresence>
        {showHistory && <TransactionHistory onClose={() => setShowHistory(false)} />}
      </AnimatePresence>

      {/* My QR / Receive modal — both layouts */}
      <AnimatePresence>
        {showMyQR && (
          <MerchantQRModal
            onClose={() => setShowMyQR(false)}
            user={supabaseUser}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile Scan Home — the Google Pay / PhonePe moment
// ─────────────────────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { icon: Send,        label: "Send money",      color: "#7c3aed", text: "Send ₹500 to Priya" },
  { icon: Lock,        label: "Lock savings",    color: "#10b981", text: "Lock ₹2000 for 3 months" },
  { icon: FileText,    label: "Stamp agreement", color: "#3b82f6", text: "Arjun owes me ₹1500 — record it" },
  { icon: ShieldCheck, label: "Prove ownership", color: "#f59e0b", text: "Prove I own this photo" },
];

function MobileScanHome({
  address,
  isConnected,
  user,
  onScan,
  onMyQR,
  onQuickAction,
  onSignOut,
  onConnect,
}: {
  readonly address: string | null;
  readonly isConnected: boolean;
  readonly user: User | null;
  readonly onScan: () => void;
  readonly onMyQR: () => void;
  readonly onQuickAction: (text: string) => void;
  readonly onSignOut: () => void;
  readonly onConnect: () => void;
}) {

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

  const displayName = user?.user_metadata?.full_name?.split(" ")[0]
    ?? user?.email?.split("@")[0]
    ?? "there";

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="h-full overflow-y-auto" style={{ paddingBottom: "8px" }}>
      <div className="flex flex-col gap-5 px-4 pt-5 pb-4">

        {/* ── Greeting + balance card ─────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(201,168,76,0.12) 0%, rgba(201,168,76,0.05) 100%)",
            border: "1px solid rgba(201,168,76,0.2)",
            padding: "20px",
          }}
        >
          <p style={{ fontSize: "12px", color: "rgba(201,168,76,0.7)", marginBottom: "2px" }}>
            {greeting}, {displayName}
          </p>

          {isConnected ? (
            <>
              <div className="flex items-baseline gap-2 mt-1 mb-4">
                <span style={{ fontSize: "clamp(24px, 8vw, 36px)", fontWeight: 900, color: "#F0EEE8", letterSpacing: "-0.03em", lineHeight: 1 }}>
                  {usdcBalance.toFixed(2)}
                </span>
                <span style={{ fontSize: "14px", color: "rgba(201,168,76,0.8)", fontWeight: 600 }}>USDC</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                    {solBalance.toFixed(4)} SOL
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.15)", fontSize: "12px" }}>·</span>
                  <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", fontFamily: "monospace" }}>
                    {shortAddr(address ?? "")}
                  </span>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
            </>
          ) : (
            <div className="mt-3">
              <p style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "12px" }}>
                Connect your Phantom wallet to start
              </p>
              <motion.button
                onClick={onConnect}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold"
                style={{ background: "rgba(201,168,76,0.15)", border: "1px solid rgba(201,168,76,0.3)", color: "#C9A84C" }}
              >
                <Wallet size={15} /> Connect Phantom
              </motion.button>
            </div>
          )}
        </motion.div>

        {/* ── Big scan button ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center"
        >
          {/* Outer ring glow — responsive size */}
          <div className="relative flex items-center justify-center p-4">
            {/* Pulse rings */}
            <motion.div
              animate={{ scale: [1, 1.4, 1], opacity: [0.25, 0, 0.25] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
              className="absolute rounded-full pointer-events-none"
              style={{ width: "min(140px, 38vw)", height: "min(140px, 38vw)", border: "2px solid rgba(201,168,76,0.4)" }}
            />
            <motion.div
              animate={{ scale: [1, 1.7, 1], opacity: [0.15, 0, 0.15] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
              className="absolute rounded-full pointer-events-none"
              style={{ width: "min(140px, 38vw)", height: "min(140px, 38vw)", border: "1px solid rgba(201,168,76,0.3)" }}
            />

            {/* The button itself */}
            <motion.button
              onClick={onScan}
              whileTap={{ scale: 0.93 }}
              whileHover={{ scale: 1.03 }}
              aria-label="Scan UPI QR code to pay"
              className="relative rounded-full flex flex-col items-center justify-center gap-2"
              style={{
                width: "min(140px, 38vw)",
                height: "min(140px, 38vw)",
                background: "linear-gradient(135deg, #C9A84C, #F0D080, #C9A84C)",
                boxShadow: "0 8px 40px rgba(201,168,76,0.45), 0 2px 8px rgba(0,0,0,0.4)",
              }}
            >
              <QrCode size={36} style={{ color: "#080810" }} />
              <span style={{ fontSize: "10px", fontWeight: 800, color: "#080810", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                Scan to Pay
              </span>
            </motion.button>
          </div>

          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", marginTop: "8px", letterSpacing: "0.02em" }}>
            Any Google Pay · PhonePe · Paytm QR
          </p>

          {/* Receive / My QR secondary button */}
          <motion.button
            onClick={onMyQR}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            style={{
              marginTop: "12px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              borderRadius: "14px",
              padding: "10px 20px",
              background: "rgba(201,168,76,0.08)",
              border: "1px solid rgba(201,168,76,0.2)",
              color: "rgba(201,168,76,0.85)",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.02em",
            }}
          >
            <QrCode size={14} />
            My QR · Receive
          </motion.button>
        </motion.div>

        {/* ── Divider ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />
          <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            or ask Auron
          </span>
          <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />
        </div>

        {/* ── Quick actions ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="grid grid-cols-2 gap-2.5"
        >
          {QUICK_ACTIONS.map(({ icon: Icon, label, color, text }, i) => (
            <motion.button
              key={label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.05 }}
              onClick={() => onQuickAction(text)}
              whileTap={{ scale: 0.96 }}
              className="flex items-center gap-3 rounded-xl text-left"
              style={{
                padding: "14px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${color}18`, border: `1px solid ${color}28` }}>
                <Icon size={14} style={{ color }} />
              </div>
              <div className="min-w-0">
                <p style={{ fontSize: "12px", fontWeight: 600, color: "#F0EEE8", lineHeight: 1.2 }}>{label}</p>
              </div>
              <ChevronRight size={12} style={{ color: "rgba(255,255,255,0.2)", marginLeft: "auto", flexShrink: 0 }} />
            </motion.button>
          ))}
        </motion.div>

        {/* ── Tagline ───────────────────────────────────────────────── */}
        <div className="text-center pt-2 pb-1">
          <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.15)", letterSpacing: "0.06em" }}>
            POWERED BY SOLANA · CLAUDE AI · PHANTOM
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile bottom navigation bar
// ─────────────────────────────────────────────────────────────────────────────
function MobileBottomNav({
  tab,
  setTab,
}: {
  readonly tab: MobileTab;
  readonly setTab: (t: MobileTab) => void;
}) {
  const tabs = [
    { id: "scan" as MobileTab, label: "Scan & Pay", icon: QrCode },
    { id: "chat" as MobileTab, label: "Chat",       icon: MessageSquare },
  ];

  return (
    <motion.nav
      initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.3, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative z-20 shrink-0 grid grid-cols-2 pb-safe"
      style={{
        background: "rgba(8,8,16,0.97)",
        borderTop: "1px solid rgba(201,168,76,0.1)",
        backdropFilter: "blur(24px) saturate(160%)",
      }}
    >
      {tabs.map(({ id, label, icon: Icon }) => {
        const active = tab === id;
        return (
          <button
            key={id}
            onClick={() => setTab(id)}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className="relative flex flex-col items-center justify-center gap-1 py-3 transition-all duration-200"
          >
            {/* Active indicator */}
            <AnimatePresence>
              {active && (
                <motion.div
                  layoutId="mobile-tab-indicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full"
                  style={{ background: "linear-gradient(90deg, #C9A84C, #F0D080)" }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                />
              )}
            </AnimatePresence>

            <motion.div
              animate={active ? { scale: 1.1 } : { scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <Icon
                size={20}
                style={{
                  color: active ? "#C9A84C" : "rgba(255,255,255,0.28)",
                  transition: "color 0.2s",
                }}
              />
            </motion.div>

            <span style={{
              fontSize: "10px",
              fontWeight: active ? 700 : 500,
              color: active ? "#C9A84C" : "rgba(255,255,255,0.28)",
              letterSpacing: "0.03em",
              transition: "all 0.2s",
            }}>
              {label}
            </span>
          </button>
        );
      })}
    </motion.nav>
  );
}
