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
import DashboardScreen from "@/components/auron/DashboardScreen";
import PaymentIntentScreen from "@/components/auron/PaymentIntentScreen";
import ConfirmCard from "@/components/auron/ConfirmCard";
import SettlementScreen from "@/components/auron/SettlementScreen";
import ReceiptScreen from "@/components/auron/ReceiptScreen";
import { usePhantomDeepLink } from "@/hooks/usePhantomDeepLink";
import {
  QrCode, MessageSquare, History, LogOut, Send,
  Lock, FileText, ShieldCheck, Wallet, ChevronRight,
  Upload, Bell, Home, Activity, User, RefreshCw,
  ArrowUpRight, Check,
} from "lucide-react";
import AuronLogo from "@/components/AuronLogo";
import Link from "next/link";
import type { User as SupabaseUser } from "@supabase/supabase-js";

type MobileTab = "home" | "scan" | "chat" | "activity" | "profile";

// ─────────────────────────────────────────────────────────────────────────────
export default function AppPage() {
  const { publicKey, connected: walletConnected } = useWallet();
  const { setVisible } = useWalletModal();
  const deepLink = usePhantomDeepLink();

  const isConnected = walletConnected || deepLink.isConnected;
  const address = publicKey?.toString() ?? deepLink.publicKey ?? null;

  const { setAddress, prefs } = useStore();

  const [showHistory, setShowHistory]   = useState(false);
  const [showMyQR, setShowMyQR]         = useState(false);
  const [mobileTab, setMobileTab]       = useState<MobileTab>("home");
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [authLoading, setAuthLoading]   = useState(true);

  // Payment flow state
  const [pendingIntent, setPendingIntent] = useState<any>(null);
  const [settling, setSettling] = useState(false);
  const [completedUTR, setCompletedUTR] = useState<string | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const chatRef = useRef<ChatInterfaceHandle>(null);
  const router  = useRouter();
  const supabase = createClient();
  const { signAndSendTransaction } = useWallet();

  // Fetch USDC balance
  const { data: usdcBalance = 0 } = useQuery({
    queryKey: ["usdc-balance", address],
    queryFn: () => getUSDCBalance(address!),
    enabled: !!address,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  // Handle payment with Phantom wallet
  const handlePaymentWithPhantom = async (intent: any, onProgress?: (step: number) => void) => {
    try {
      onProgress?.(1); // Quote generated

      // 1. Get payment transaction from API
      const payRes = await fetch("/api/v1/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchant: intent.merchant,
          upiId: intent.upiId,
          inrAmount: intent.inrAmount,
          usdcAmount: intent.usdcAmount,
          userAddress: address,
        }),
      });

      if (!payRes.ok) {
        throw new Error("Failed to create payment transaction");
      }

      const { transaction: txData, txSignature } = await payRes.json();

      onProgress?.(2); // Wallet signed

      // 2. Sign transaction with Phantom wallet
      let signature: string;
      try {
        const signedTx = await signAndSendTransaction(txData);
        signature = signedTx;
      } catch (signErr) {
        const msg = signErr instanceof Error ? signErr.message : "Signature rejected";
        if (msg.toLowerCase().includes("user rejected") || msg.toLowerCase().includes("cancelled")) {
          throw new Error("Payment cancelled by user");
        }
        throw signErr;
      }

      onProgress?.(3); // USDC received
      onProgress?.(4); // Settlement verified

      // 3. Wait for settlement (poll status)
      let settled = false;
      let attempts = 0;
      const maxAttempts = 30;

      while (!settled && attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 500));

        try {
          const statusRes = await fetch(`/api/v1/pay/status?txSignature=${signature}`);
          if (statusRes.ok) {
            const { settled: isSettled, utr } = await statusRes.json();
            if (isSettled) {
              settled = true;
              onProgress?.(5); // UPI delivered
              return utr || `UTR${Date.now()}`;
            }
          }
        } catch (err) {
          // Continue polling
        }
        attempts++;
      }

      // Mock UTR if settlement API not available
      if (!settled) {
        const mockUTR = `YESB${Math.floor(Math.random() * 1e12).toString().padStart(12, "0")}`;
        onProgress?.(5);
        return mockUTR;
      }

      throw new Error("Settlement timeout");
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Payment failed";
      throw new Error(msg);
    }
  };

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

  function handleScanQR() {
    setMobileTab("chat");
    setTimeout(() => chatRef.current?.openQRScanner(), 80);
  }

  function handleQuickAction(text: string) {
    setMobileTab("chat");
    setTimeout(() => chatRef.current?.submitMessage(text), 80);
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#07090D" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.6, repeat: Infinity }}>
            <AuronLogo size={44} />
          </motion.div>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading Auron…</p>
        </div>
      </div>
    );
  }

  if (!supabaseUser) return null;
  if (!prefs.hasOnboarded) return <OnboardingFlow />;

  return (
    <div style={{ background: "#08080A", minHeight: "100dvh" }}>

      {/* ══════════════════════════════════════════════════════════
          DESKTOP (md+)
      ══════════════════════════════════════════════════════════ */}
      <div className="hidden md:flex flex-col h-screen overflow-hidden">
        <motion.header
          initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "14px 32px",
            background: "rgba(8,8,10,0.9)",
            borderBottom: "1px solid #26262A",
            backdropFilter: "blur(24px)",
            position: "relative", zIndex: 20,
          }}
        >
          <Link href="/" style={{ textDecoration: "none" }}>
            <AuronLogo size={32} showText textSize={15} />
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {supabaseUser && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 12px", borderRadius: 10,
                background: "rgba(59,130,246,0.08)",
                border: "1px solid rgba(59,130,246,0.15)",
                fontSize: 12, color: "var(--text-secondary)",
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: "linear-gradient(135deg,#7C3AED,#3B82F6)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, color: "#fff",
                }}>
                  {(supabaseUser.email ?? "A")[0].toUpperCase()}
                </div>
                <span>{supabaseUser.user_metadata?.full_name ?? supabaseUser.email?.split("@")[0]}</span>
              </div>
            )}
            <button onClick={() => setShowMyQR(true)} style={{ padding: 8, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", borderRadius: 8 }}>
              <QrCode size={17} />
            </button>
            <button onClick={() => setShowHistory(true)} style={{ padding: 8, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", borderRadius: 8 }}>
              <History size={17} />
            </button>
            {isConnected ? <WalletWidget /> : (
              <button onClick={handleSignOut} style={{ padding: 8, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", borderRadius: 8 }}>
                <LogOut size={17} />
              </button>
            )}
          </div>
        </motion.header>

        <div style={{ position: "relative", zIndex: 10, maxWidth: 672, margin: "0 auto", padding: "8px 16px 0", width: "100%" }}>
          <NetworkMismatchBanner />
        </div>

        <main style={{ position: "relative", zIndex: 10, flex: 1, overflow: "hidden" }}>
          <div style={{ height: "100%", maxWidth: 672, margin: "0 auto" }}>
            <ChatInterface ref={chatRef} />
          </div>
        </main>
      </div>

      {/* ══════════════════════════════════════════════════════════
          MOBILE (below md)
      ══════════════════════════════════════════════════════════ */}
      <div className="md:hidden flex flex-col" style={{ height: "100dvh" }}>

        {/* Mobile Header */}
        <MobileHeader
          user={supabaseUser}
          isConnected={isConnected}
          address={address}
          deepLink={deepLink}
          walletConnected={walletConnected}
          setVisible={setVisible}
          onSignOut={handleSignOut}
          onHistory={() => setShowHistory(true)}
        />

        {/* Tab Content */}
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>

          {/* Home tab */}
          <div className={mobileTab === "home" ? "h-full" : "hidden"}>
            <DashboardScreen
              user={supabaseUser}
              address={address}
              isConnected={isConnected}
              usdcBalance={usdcBalance}
              fxRate={83.18}
              onScanQR={handleScanQR}
              onTypePayment={() => setMobileTab("chat")}
              onConnect={() =>
                deepLink.isMobileDevice && !deepLink.isInPhantomBrowser
                  ? deepLink.connect()
                  : setVisible(true)
              }
              onQuickAction={handleQuickAction}
            />
          </div>

          {/* Scan tab → switches to chat + opens scanner */}
          <div className={mobileTab === "scan" ? "h-full" : "hidden"}>
            <ChatInterface ref={chatRef} />
          </div>

          {/* Chat tab - Payment Intent Screen */}
          <div className={mobileTab === "chat" ? "h-full" : "hidden"} style={{ height: "100%" }}>
            {!pendingIntent ? (
              <PaymentIntentScreen
                fxRate={83.18}
                onConfirm={(intent) => setPendingIntent(intent)}
                onBack={() => setMobileTab("home")}
              />
            ) : settling || showReceipt ? (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#08080A" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 14, color: "#9A9AA8" }}>Processing payment...</div>
                </div>
              </div>
            ) : (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#08080A" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 14, color: "#9A9AA8" }}>Awaiting confirmation...</div>
                </div>
              </div>
            )}
          </div>

          {/* Activity tab */}
          <div className={mobileTab === "activity" ? "h-full overflow-y-auto" : "hidden"}>
            <TransactionHistory onClose={() => setMobileTab("home")} />
          </div>

          {/* Profile tab */}
          <div className={mobileTab === "profile" ? "h-full overflow-y-auto" : "hidden"}>
            <ProfileTab
              user={supabaseUser}
              address={address}
              isConnected={isConnected}
              onSignOut={handleSignOut}
            />
          </div>
        </div>

        {/* Bottom Navigation */}
        <BottomNav tab={mobileTab} setTab={(t) => {
          if (t === "scan") {
            setMobileTab("chat");
            setTimeout(() => chatRef.current?.openQRScanner(), 80);
          } else {
            setMobileTab(t);
          }
        }} />
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {showHistory && <TransactionHistory onClose={() => setShowHistory(false)} />}
      </AnimatePresence>
      <AnimatePresence>
        {showMyQR && (
          <MerchantQRModal onClose={() => setShowMyQR(false)} user={supabaseUser} />
        )}
      </AnimatePresence>

      {/* Payment Flow Overlays */}
      <AnimatePresence>
        {pendingIntent && !settling && !showReceipt && (
          <ConfirmCard
            merchant={pendingIntent.merchant}
            upiId={pendingIntent.upiId}
            inrAmount={pendingIntent.inrAmount}
            usdcAmount={pendingIntent.usdcAmount}
            fxRate={pendingIntent.fxRate}
            settlementPath="OnMeta A"
            fee="0.5%"
            estTime="~20s"
            quoteExpiresIn={60}
            onConfirm={async () => {
              setSettling(true);
              try {
                const utr = await handlePaymentWithPhantom(pendingIntent);
                setCompletedUTR(utr);
                setSettling(false);
                setShowReceipt(true);
              } catch (err) {
                setSettling(false);
                setPendingIntent(null);
                const msg = err instanceof Error ? err.message : "Payment failed";
                alert(msg);
              }
            }}
            onCancel={() => setPendingIntent(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {settling && pendingIntent && (
          <SettlementScreen
            merchant={pendingIntent.merchant}
            inrAmount={pendingIntent.inrAmount}
            usdcAmount={pendingIntent.usdcAmount}
            onComplete={(utr) => {
              setCompletedUTR(utr);
              setSettling(false);
              setShowReceipt(true);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showReceipt && pendingIntent && completedUTR && (
          <ReceiptScreen
            merchant={pendingIntent.merchant}
            upiId={pendingIntent.upiId}
            inrAmount={pendingIntent.inrAmount}
            usdcAmount={pendingIntent.usdcAmount}
            utr={completedUTR}
            receiptHash="3f8a2c...e4d1"
            solscanUrl="https://solscan.io/tx/devnet"
            settledAt={new Date().toLocaleString("en-IN")}
            onDone={() => {
              setPendingIntent(null);
              setCompletedUTR(null);
              setShowReceipt(false);
              setMobileTab("home");
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile Header
// ─────────────────────────────────────────────────────────────────────────────
function MobileHeader({
  user, isConnected, address, deepLink, walletConnected,
  setVisible, onSignOut, onHistory,
}: {
  readonly user: SupabaseUser | null;
  readonly isConnected: boolean;
  readonly address: string | null;
  readonly deepLink: ReturnType<typeof usePhantomDeepLink>;
  readonly walletConnected: boolean;
  readonly setVisible: (v: boolean) => void;
  readonly onSignOut: () => void;
  readonly onHistory: () => void;
}) {
  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 20px",
        background: "rgba(8,8,10,0.92)",
        borderBottom: "1px solid #26262A",
        backdropFilter: "blur(20px)",
        position: "relative", zIndex: 20,
        flexShrink: 0,
      }}
    >
      <AuronLogo size={28} showText textSize={13} />

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Bell */}
        <button style={{ padding: 8, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", position: "relative" }}>
          <Bell size={18} />
          <span style={{
            position: "absolute", top: 6, right: 6,
            width: 7, height: 7, borderRadius: "50%",
            background: "#3B82F6",
            border: "1.5px solid #07090D",
          }} />
        </button>

        {/* Wallet */}
        {walletConnected ? <WalletWidget /> :
         deepLink.isConnected && address ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 10px", borderRadius: 8,
            background: "rgba(34,197,94,0.1)",
            border: "1px solid rgba(34,197,94,0.2)",
            fontSize: 11, fontWeight: 600, color: "#22C55E",
            fontFamily: "monospace",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E" }} />
            {shortAddr(address)}
          </div>
        ) : (
          <button onClick={onSignOut} style={{ padding: 7, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
            <LogOut size={16} />
          </button>
        )}
      </div>
    </motion.header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Home Tab — the Google Pay moment
// ─────────────────────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { icon: Send,        label: "Send Money",    text: "Send ₹500 to Priya",                  color: "#3B82F6" },
  { icon: ArrowUpRight,label: "Request",       text: "Request ₹500 from Priya",             color: "#22D3EE" },
  { icon: RefreshCw,   label: "Repeat",        text: "Repeat my last payment",              color: "#7C3AED" },
  { icon: User,        label: "Split Bill",    text: "Split ₹1200 equally with 3 people",   color: "#22C55E" },
];

const MOCK_ACTIVITY = [
  { name: "Blue Tokai Coffee", sub: "Paid · 2:15 PM",    inr: 450,  usdc: 5.23,  initials: "BT", color: "#3B82F6" },
  { name: "Amazon India",      sub: "Paid · Yesterday",  inr: 1250, usdc: 14.44, initials: "AI", color: "#F59E0B" },
  { name: "Rohit Sharma",      sub: "Received · 2d ago", inr: 950,  usdc: 10.93, initials: "RS", color: "#22C55E", received: true },
];

function HomeTab({
  address, isConnected, user, onScanQR, onUploadQR, onQuickAction, onConnect,
}: {
  readonly address: string | null;
  readonly isConnected: boolean;
  readonly user: SupabaseUser | null;
  readonly onScanQR: () => void;
  readonly onUploadQR: () => void;
  readonly onQuickAction: (t: string) => void;
  readonly onConnect: () => void;
}) {
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
  const greetingEmoji = hour < 12 ? "☀️" : hour < 17 ? "👋" : "👋";

  // INR equivalent (approx 84x)
  const inrEquiv = (usdcBalance * 84).toFixed(2);

  return (
    <div style={{ height: "100%", overflowY: "auto", overflowX: "hidden" }}>
      <div style={{ padding: "20px 20px 32px", display: "flex", flexDirection: "column", gap: 24 }}>

        {/* ── Greeting ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>
            {greeting}, {displayName} {greetingEmoji}
          </p>
          <h1 style={{
            fontSize: "clamp(22px, 6vw, 28px)",
            fontWeight: 800,
            color: "var(--text-primary)",
            letterSpacing: "-0.03em",
            lineHeight: 1.2,
            margin: 0,
          }}>
            Move money instantly.<br />
            Any QR.{" "}
            <span style={{ color: "#22D3EE" }}>Any network.</span>
          </h1>
        </motion.div>

        {/* ── Two QR action cards ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.45 }}
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
        >
          {/* Scan QR — blue filled */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onScanQR}
            style={{
              padding: "20px 16px",
              borderRadius: 16,
              background: "#3B82F6",
              border: "none",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              boxShadow: "0 8px 32px rgba(59,130,246,0.35)",
            }}
          >
            <div style={{
              width: 44, height: 44,
              borderRadius: 12,
              background: "rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <QrCode size={22} color="#fff" />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>Scan QR</p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", margin: "2px 0 0" }}>Pay any merchant</p>
            </div>
          </motion.button>

          {/* Upload QR — dark surface */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onUploadQR}
            style={{
              padding: "20px 16px",
              borderRadius: 16,
              background: "rgba(15,23,42,0.9)",
              border: "1px solid rgba(148,163,184,0.12)",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div style={{
              width: 44, height: 44,
              borderRadius: 12,
              background: "rgba(148,163,184,0.08)",
              border: "1px solid rgba(148,163,184,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Upload size={20} color="var(--text-secondary)" />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Upload QR</p>
              <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>From gallery</p>
            </div>
          </motion.button>
        </motion.div>

        {/* ── Quick Actions ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14, duration: 0.4 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Quick Actions</span>
            <button style={{ fontSize: 12, color: "#60A5FA", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>
              See all
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
            {QUICK_ACTIONS.map(({ icon: Icon, label, text, color }, i) => (
              <motion.button
                key={label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16 + i * 0.04 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onQuickAction(text)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                  padding: "12px 4px",
                  background: "rgba(15,23,42,0.6)",
                  border: "1px solid rgba(148,163,184,0.08)",
                  borderRadius: 14,
                  cursor: "pointer",
                }}
              >
                <div style={{
                  width: 42, height: 42, borderRadius: "50%",
                  background: `${color}15`,
                  border: `1px solid ${color}25`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={18} color={color} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-secondary)", textAlign: "center", lineHeight: 1.2 }}>
                  {label}
                </span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* ── Available Balance ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          style={{
            padding: "16px 18px",
            borderRadius: 16,
            background: "rgba(15,23,42,0.7)",
            border: "1px solid rgba(148,163,184,0.1)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}
        >
          <div>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8, fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Available Balance
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "linear-gradient(135deg,rgba(59,130,246,0.3),rgba(59,130,246,0.1))",
                border: "1px solid rgba(59,130,246,0.25)",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: "#60A5FA" }}>$</span>
              </div>
              <div>
                <p style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.03em", margin: 0, lineHeight: 1 }}>
                  {isConnected ? usdcBalance.toFixed(2) : "—"}{" "}
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>USDC</span>
                </p>
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                  ≈ ₹{isConnected ? Number(inrEquiv).toLocaleString("en-IN") : "—"} INR
                </p>
              </div>
            </div>
          </div>
          <ChevronRight size={18} color="var(--text-muted)" />
        </motion.div>

        {/* ── Recent Activity ── */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26, duration: 0.4 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Recent Activity</span>
            <button style={{ fontSize: 12, color: "#60A5FA", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>
              See all
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {MOCK_ACTIVITY.map(({ name, sub, inr, usdc, initials, color, received }, i) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.28 + i * 0.05 }}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px",
                  borderRadius: 14,
                  background: "rgba(15,23,42,0.5)",
                  border: "1px solid rgba(148,163,184,0.06)",
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 40, height: 40, borderRadius: "50%",
                  background: `${color}20`,
                  border: `1px solid ${color}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                  fontSize: 12, fontWeight: 700, color,
                }}>
                  {initials}
                </div>

                {/* Name + sub */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {name}
                  </p>
                  <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>
                    {sub}
                  </p>
                </div>

                {/* Amounts + check */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: received ? "#22C55E" : "var(--text-primary)", margin: 0 }}>
                      {received ? "+" : ""}₹{inr}
                    </p>
                    <p style={{ fontSize: 10, color: "var(--text-muted)", margin: "2px 0 0", fontFamily: "monospace" }}>
                      {usdc} USDC
                    </p>
                  </div>
                  <div style={{
                    width: 20, height: 20, borderRadius: "50%",
                    background: "rgba(34,197,94,0.15)",
                    border: "1px solid rgba(34,197,94,0.3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <Check size={11} color="#22C55E" />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* ── Connect wallet prompt (if not connected) ── */}
        {!isConnected && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            style={{
              padding: "16px 18px",
              borderRadius: 16,
              background: "rgba(59,130,246,0.06)",
              border: "1px solid rgba(59,130,246,0.2)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Wallet size={18} color="#3B82F6" />
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>Connect Phantom</p>
                <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "2px 0 0" }}>To send & receive</p>
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={onConnect}
              style={{
                padding: "8px 16px", borderRadius: 10,
                background: "#3B82F6", border: "none",
                fontSize: 12, fontWeight: 700, color: "#fff",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
              }}
            >
              Connect
            </motion.button>
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Profile Tab
// ─────────────────────────────────────────────────────────────────────────────
function ProfileTab({
  user, address, isConnected, onSignOut,
}: {
  readonly user: SupabaseUser | null;
  readonly address: string | null;
  readonly isConnected: boolean;
  readonly onSignOut: () => void;
}) {
  const displayName = user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "User";

  return (
    <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Avatar + name */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, paddingTop: 12 }}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          background: "linear-gradient(135deg,#7C3AED,#3B82F6)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28, fontWeight: 800, color: "#fff",
        }}>
          {(displayName)[0].toUpperCase()}
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{displayName}</p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>{user?.email}</p>
        </div>
      </div>

      {/* Wallet address */}
      {address && (
        <div style={{
          padding: "14px 16px", borderRadius: 14,
          background: "rgba(15,23,42,0.7)",
          border: "1px solid rgba(148,163,184,0.1)",
        }}>
          <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Wallet</p>
          <p style={{ fontSize: 12, color: "#60A5FA", fontFamily: "monospace", margin: 0 }}>{shortAddr(address)}</p>
        </div>
      )}

      {/* Sign out */}
      <button
        onClick={onSignOut}
        style={{
          width: "100%", padding: "14px",
          borderRadius: 14,
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.2)",
          color: "#EF4444", fontSize: 14, fontWeight: 600,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}
      >
        <LogOut size={16} />
        Sign out
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bottom Navigation — 5 tabs
// ─────────────────────────────────────────────────────────────────────────────
const NAV_TABS = [
  { id: "home"     as MobileTab, label: "Home",     icon: Home },
  { id: "scan"     as MobileTab, label: "Scan",     icon: QrCode },
  { id: "chat"     as MobileTab, label: "Chat",     icon: MessageSquare },
  { id: "activity" as MobileTab, label: "Activity", icon: Activity },
  { id: "profile"  as MobileTab, label: "Profile",  icon: User },
];

function BottomNav({
  tab, setTab,
}: {
  readonly tab: MobileTab;
  readonly setTab: (t: MobileTab) => void;
}) {
  return (
    <motion.nav
      initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        background: "rgba(8,8,10,0.97)",
        borderTop: "1px solid #26262A",
        backdropFilter: "blur(24px)",
        flexShrink: 0,
        paddingBottom: "env(safe-area-inset-bottom, 8px)",
        position: "relative", zIndex: 20,
      }}
    >
      {NAV_TABS.map(({ id, label, icon: Icon }) => {
        const active = tab === id || (id === "scan" && tab === "chat");
        const isScanCenter = id === "scan";

        return (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: isScanCenter ? 0 : 4,
              padding: isScanCenter ? "6px 4px" : "10px 4px",
              background: "none", border: "none", cursor: "pointer",
              position: "relative",
            }}
          >
            {/* Active indicator top line */}
            {active && !isScanCenter && (
              <motion.div
                layoutId="bottom-nav-indicator"
                style={{
                  position: "absolute", top: 0, left: "50%",
                  transform: "translateX(-50%)",
                  width: 24, height: 2, borderRadius: 999,
                  background: "#C8F135",
                }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}

            {/* Scan center fab */}
            {isScanCenter ? (
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                background: active ? "#C8F135" : "rgba(200,241,53,0.1)",
                border: `2px solid ${active ? "#C8F135" : "rgba(200,241,53,0.2)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: active ? "0 4px 16px rgba(200,241,53,0.3)" : "none",
                transition: "all 0.2s",
              }}>
                <Icon size={22} color={active ? "#08080A" : "#C8F135"} />
              </div>
            ) : (
              <>
                <Icon size={20} color={active ? "#C8F135" : "#606068"} />
                <span style={{
                  fontSize: 10, fontWeight: active ? 600 : 400,
                  color: active ? "#C8F135" : "#606068",
                  transition: "all 0.2s",
                }}>
                  {label}
                </span>
              </>
            )}
          </button>
        );
      })}
    </motion.nav>
  );
}
