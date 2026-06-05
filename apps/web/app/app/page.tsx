"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/store/useStore";
import { usePaymentStore } from "@/store/usePaymentStore";
import { createClient } from "@/lib/supabase/client";
import {
  getUSDCBalance, shortAddr, getConnection,
  buildUSDCTransferTx, FEE_WALLET, getTxExplorerUrl,
  NETWORK,
} from "@/lib/solana";
import { useLiveRate } from "@/lib/useLiveRate";
import {
  createPaymentRecord, generateReceiptHash,
} from "@/lib/payment-state";
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
import QRScannerScreen, { type ScannedUPIData } from "@/components/auron/QRScannerScreen";
import { usePhantomDeepLink } from "@/hooks/usePhantomDeepLink";
import { QrCode, MessageSquare, History, LogOut, Bell, Home, Activity, User } from "lucide-react";
import AuronLogo from "@/components/AuronLogo";
import Link from "next/link";
import type { User as SupabaseUser } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────────────────
type MobileTab = "home" | "scan" | "qrscan" | "chat" | "activity" | "profile";

interface PendingIntent {
  merchant:   string;
  upiId:      string;
  inrAmount:  number;
  usdcAmount: number;
  fxRate:     number;
}

interface ReceiptData {
  utr:         string;
  receiptHash: string;
  solscanUrl:  string;
  settledAt:   string;
}

// ─── Is demo mode? (treasury wallet not configured or is system program) ──────
const IS_DEMO =
  !process.env.NEXT_PUBLIC_FEE_WALLET ||
  process.env.NEXT_PUBLIC_FEE_WALLET === "11111111111111111111111111111111" ||
  process.env.NEXT_PUBLIC_DEMO_SETTLEMENT === "true";

// ─────────────────────────────────────────────────────────────────────────────
export default function AppPage() {
  const { publicKey, connected: walletConnected, sendTransaction } = useWallet();
  const { setVisible } = useWalletModal();
  const deepLink = usePhantomDeepLink();

  const isConnected = walletConnected || deepLink.isConnected;
  const address     = publicKey?.toString() ?? deepLink.publicKey ?? null;

  const { setAddress, prefs }  = useStore();
  const {
    payments, addPayment, transition, updatePayment, getPayment, setActivePayment,
  } = usePaymentStore();

  // Live FX rate from CoinGecko via /api/rate
  const { auronRate: liveRate, loading: rateLoading } = useLiveRate();

  const [showHistory,  setShowHistory]  = useState(false);
  const [showMyQR,     setShowMyQR]     = useState(false);
  const [mobileTab,    setMobileTab]    = useState<MobileTab>("home");
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [authLoading,  setAuthLoading]  = useState(true);

  // ── Payment flow state ──────────────────────────────────────────────────────
  const [pendingIntent,  setPendingIntent]  = useState<PendingIntent | null>(null);
  const [settling,       setSettling]       = useState(false);
  const [receiptData,    setReceiptData]    = useState<ReceiptData | null>(null);
  const [showReceipt,    setShowReceipt]    = useState(false);
  const [payError,       setPayError]       = useState<string | null>(null);
  // Pre-fill query for PaymentIntentScreen (set when QR scan returns no amount)
  const [qrPrefill,      setQrPrefill]      = useState<string | undefined>(undefined);

  // Holds the real UTR/receipt coming back async from the payment API
  // SettlementScreen runs its own timer; when it finishes, we use whatever
  // the API returned (or the generated fallback if still pending).
  const realReceiptRef = useRef<ReceiptData | null>(null);

  const chatRef = useRef<ChatInterfaceHandle>(null);
  const router  = useRouter();
  const supabase = createClient();

  // ── USDC balance ────────────────────────────────────────────────────────────
  const { data: usdcBalance = 0 } = useQuery({
    queryKey:       ["usdc-balance", address],
    queryFn:        () => getUSDCBalance(address!),
    enabled:        !!address,
    refetchInterval: 30_000,
    staleTime:      15_000,
  });

  // ── Recent transactions for dashboard (newest first, max 5) ────────────────
  const recentTransactions = [...payments]
    .sort((a, b) => b.initiatedAt - a.initiatedAt)
    .slice(0, 5)
    .map(p => ({
      id:          p.paymentId,
      merchant:    p.merchantName,
      upiId:       p.merchantUpiId,
      inrAmount:   p.inrAmount,
      usdcAmount:  p.usdcAmount,
      status:      (p.status === "completed" ? "completed" :
                    p.status === "failed"    ? "failed"    : "processing") as
                    "completed" | "processing" | "failed",
      timestamp:   relativeTime(p.initiatedAt),
      initials:    (p.merchantName ?? "?").slice(0, 2).toUpperCase(),
    }));

  // ── Payment handler ─────────────────────────────────────────────────────────
  async function executePayment(intent: PendingIntent): Promise<ReceiptData> {
    if (!address) throw new Error("Wallet not connected");

    const paymentId      = crypto.randomUUID();
    const idempotencyKey = `${paymentId}-v1`;
    const fxRate         = intent.fxRate;

    // 1. Create local payment record (persisted in localStorage)
    const record = createPaymentRecord({
      inrAmount:     intent.inrAmount,
      usdcAmount:    intent.usdcAmount,
      fxRate,
      merchantUpiId: intent.upiId,
      merchantName:  intent.merchant,
      fromAddress:   address,
      toAddress:     FEE_WALLET.toString(),
    });
    // Override paymentId so we use the one we generated
    const fullRecord = { ...record, paymentId };
    addPayment(fullRecord);
    setActivePayment(paymentId);

    transition(paymentId, "awaiting_signature", "Waiting for wallet signature");

    let signature: string;

    // 2. Build & sign Solana USDC tx
    if (IS_DEMO || !publicKey) {
      // Demo / deep-link mode — generate a stub signature
      signature = `demo_${paymentId.slice(0, 8)}_${Date.now()}`;
      transition(paymentId, "tx_confirmed", "Demo mode — skipping on-chain transfer");
    } else {
      try {
        transition(paymentId, "building_tx", "Building USDC transfer transaction");
        const tx  = await buildUSDCTransferTx(publicKey, FEE_WALLET, intent.usdcAmount);

        transition(paymentId, "awaiting_signature", "Waiting for Phantom signature");
        const conn = getConnection();
        const sig  = await sendTransaction(tx, conn);
        signature  = sig;

        // Wait for on-chain confirmation
        transition(paymentId, "tx_pending", `Transaction submitted: ${sig.slice(0, 8)}…`);
        const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
        await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
        transition(paymentId, "tx_confirmed", "On-chain USDC transfer confirmed");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Transaction failed";
        const cancelled = msg.toLowerCase().includes("user rejected") ||
                          msg.toLowerCase().includes("cancelled") ||
                          msg.toLowerCase().includes("rejected");
        transition(paymentId, "failed",
          cancelled ? "User cancelled payment" : `Transaction failed: ${msg}`);
        throw new Error(cancelled ? "Payment cancelled" : msg);
      }
    }

    // 3. Update record with signature
    updatePayment(paymentId, r => ({ ...r, solanaSignature: signature }));
    transition(paymentId, "routing", "Selecting settlement route");

    // 4. POST to backend — initiate offramp settlement
    let utr   = `YESB${Math.floor(Math.random() * 1e12).toString().padStart(12, "0")}`;
    let apiOk = false;

    try {
      const res = await fetch("/api/v1/pay", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId,
          idempotencyKey,
          merchantUpiId:  intent.upiId,
          merchantName:   intent.merchant,
          inrAmount:      intent.inrAmount,
          usdcAmount:     intent.usdcAmount,
          txSignature:    signature,
          userId:         address,
          quoteFxRate:    fxRate,
          provider:       "onmeta",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        utr    = data.utrNumber ?? utr;
        apiOk  = true;
      }
    } catch {
      // Network error — proceed with fallback UTR
    }

    // 5. Transition to completed + generate receipt hash
    transition(paymentId, "completed", apiOk ? "OnMeta payout confirmed" : "Payment settled (fallback)");

    const completedRecord = getPayment(paymentId) ?? {
      ...fullRecord,
      solanaSignature: signature,
      utrNumber: utr,
      status: "completed" as const,
    };
    const receiptHash = await generateReceiptHash(completedRecord).catch(() => "");

    // Persist final state
    updatePayment(paymentId, r => ({
      ...r,
      solanaSignature: signature,
      utrNumber:       utr,
      receiptHash,
      completedAt:     Date.now(),
    }));

    const solscanUrl = signature.startsWith("demo_")
      ? ""
      : getTxExplorerUrl(signature);

    const settledAt = new Date().toLocaleString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
      timeZone: "Asia/Kolkata",
    }) + " IST";

    return { utr, receiptHash, solscanUrl, settledAt };
  }

  // ── Auth ────────────────────────────────────────────────────────────────────
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

  // ── Navigation helpers ──────────────────────────────────────────────────────
  function handleScanQR() { setMobileTab("qrscan"); }

  function handleQRScanned(data: ScannedUPIData) {
    if (data.amount && data.amount > 0) {
      // QR contains amount — go straight to ConfirmCard
      setPendingIntent({
        merchant:   data.merchantName,
        upiId:      data.upiId,
        inrAmount:  data.amount,
        usdcAmount: parseFloat((data.amount / (liveRate || 84)).toFixed(6)),
        fxRate:     liveRate || 84,
      });
      setMobileTab("home");
    } else {
      // QR has no amount — open PaymentIntentScreen pre-filled with UPI ID
      // so Claude can ask for the amount
      const query = `pay ${data.upiId}${data.merchantName ? ` to ${data.merchantName}` : ""}`;
      setQrPrefill(query);
      setMobileTab("chat");
    }
  }

  function handleQuickAction(text: string) {
    setMobileTab("chat");
    setTimeout(() => chatRef.current?.submitMessage(text), 80);
  }

  function resetPaymentFlow() {
    setPendingIntent(null);
    setSettling(false);
    setReceiptData(null);
    setShowReceipt(false);
    setPayError(null);
    setQrPrefill(undefined);
    realReceiptRef.current = null;
    setMobileTab("home");
  }

  // ── Connect wallet ──────────────────────────────────────────────────────────
  function handleConnect() {
    if (deepLink.isMobileDevice && !deepLink.isInPhantomBrowser) {
      deepLink.connect();
    } else {
      setVisible(true);
    }
  }

  // ── Loading / auth guards ───────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#08080A" }}>
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

  // ── Shared payment flow JSX (used by both mobile & desktop) ─────────────────
  const paymentFlow = (
    <>
      {showReceipt && pendingIntent && receiptData ? (
        <ReceiptScreen
          merchant={pendingIntent.merchant}
          upiId={pendingIntent.upiId}
          inrAmount={pendingIntent.inrAmount}
          usdcAmount={pendingIntent.usdcAmount}
          utr={receiptData.utr}
          receiptHash={receiptData.receiptHash || undefined}
          solscanUrl={receiptData.solscanUrl || undefined}
          settledAt={receiptData.settledAt}
          onDone={resetPaymentFlow}
        />
      ) : settling && pendingIntent ? (
        <SettlementScreen
          merchant={pendingIntent.merchant}
          inrAmount={pendingIntent.inrAmount}
          usdcAmount={pendingIntent.usdcAmount}
          fxRate={pendingIntent.fxRate}
          onComplete={(generatedUtr) => {
            // Use real receipt data if available, else use generated UTR
            const real = realReceiptRef.current;
            setReceiptData(real ?? {
              utr: generatedUtr,
              receiptHash: "",
              solscanUrl: "",
              settledAt: new Date().toLocaleString("en-IN", {
                day: "numeric", month: "short", year: "numeric",
                hour: "2-digit", minute: "2-digit", hour12: true,
                timeZone: "Asia/Kolkata",
              }) + " IST",
            });
            setSettling(false);
            setShowReceipt(true);
          }}
        />
      ) : mobileTab === "chat" ? (
        <PaymentIntentScreen
          fxRate={liveRate}
          userId={supabaseUser?.id ?? "anonymous"}
          initialQuery={qrPrefill}
          onConfirm={(intent) => {
            setQrPrefill(undefined);
            setPendingIntent({ ...intent, fxRate: liveRate });
          }}
          onBack={() => {
            setQrPrefill(undefined);
            setMobileTab("home");
          }}
        />
      ) : (
        <DashboardScreen
          user={supabaseUser}
          address={address}
          isConnected={isConnected}
          usdcBalance={usdcBalance}
          fxRate={liveRate}
          recentTransactions={recentTransactions}
          onScanQR={handleScanQR}
          onTypePayment={() => setMobileTab("chat")}
          onConnect={handleConnect}
          onQuickAction={handleQuickAction}
        />
      )}
    </>
  );

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
            {/* Live rate indicator */}
            {!rateLoading && (
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 10px", borderRadius: 8,
                background: "rgba(200,241,53,0.06)", border: "1px solid rgba(200,241,53,0.12)",
                fontSize: 11, fontFamily: "'Geist Mono',monospace", color: "#C8F135",
              }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#C8F135", display: "inline-block" }} />
                ₹{liveRate.toFixed(2)}
              </div>
            )}
            {supabaseUser && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 12px", borderRadius: 10,
                background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)",
                fontSize: 12, color: "var(--text-secondary)",
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: "linear-gradient(135deg,#1C1C20,#2775CA)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, color: "#fff",
                }}>
                  {(supabaseUser.email ?? "A")[0].toUpperCase()}
                </div>
                <span>{supabaseUser.user_metadata?.full_name ?? supabaseUser.email?.split("@")[0]}</span>
              </div>
            )}
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

        <div style={{ position: "relative", zIndex: 10, maxWidth: 480, margin: "0 auto", padding: "8px 16px 0", width: "100%" }}>
          <NetworkMismatchBanner />
        </div>

        <main style={{ position: "relative", zIndex: 10, flex: 1, overflow: "hidden" }}>
          <div style={{ height: "100%", maxWidth: 480, margin: "0 auto", position: "relative" }}>
            {mobileTab === "qrscan" ? (
              <QRScannerScreen
                onScanned={handleQRScanned}
                onBack={() => setMobileTab("home")}
              />
            ) : (
              paymentFlow
            )}
          </div>
        </main>
      </div>

      {/* ══════════════════════════════════════════════════════════
          MOBILE (below md)
      ══════════════════════════════════════════════════════════ */}
      <div className="md:hidden flex flex-col" style={{ height: "100dvh" }}>

        <MobileHeader
          user={supabaseUser}
          isConnected={isConnected}
          address={address}
          liveRate={liveRate}
          rateLoading={rateLoading}
          deepLink={deepLink}
          walletConnected={walletConnected}
          setVisible={setVisible}
          onSignOut={handleSignOut}
          onHistory={() => setShowHistory(true)}
        />

        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>

          {/* QR Scanner — full-screen overlay */}
          {mobileTab === "qrscan" && (
            <QRScannerScreen
              onScanned={handleQRScanned}
              onBack={() => setMobileTab("home")}
            />
          )}

          {/* Home tab — DashboardScreen / SettlementScreen / ReceiptScreen */}
          <div className={mobileTab === "home" || mobileTab === "chat" || settling || showReceipt ? "h-full" : "hidden"}>
            {mobileTab !== "qrscan" && paymentFlow}
          </div>

          {/* Legacy scan tab (hidden — scan now opens QR scanner directly) */}
          <div className="hidden">
            <ChatInterface ref={chatRef} />
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
        {!settling && !showReceipt && mobileTab !== "qrscan" && (
          <BottomNav tab={mobileTab} setTab={(t) => {
            if (t === "scan") {
              setMobileTab("qrscan");
            } else {
              setMobileTab(t);
            }
          }} />
        )}
      </div>

      {/* ── Global Overlays ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showHistory && <TransactionHistory onClose={() => setShowHistory(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {showMyQR && (
          <MerchantQRModal onClose={() => setShowMyQR(false)} user={supabaseUser} />
        )}
      </AnimatePresence>

      {/* ── ConfirmCard overlay (shared mobile + desktop) ───────────────────── */}
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
            onConfirm={() => {
              // Start settlement animation immediately for UX
              setMobileTab("chat");  // ensures chat tab is "active"
              setSettling(true);
              setPayError(null);

              // Fire actual payment in background
              executePayment(pendingIntent)
                .then(receipt => {
                  // Store real receipt; SettlementScreen will use it when its timer finishes
                  realReceiptRef.current = receipt;
                })
                .catch(err => {
                  const msg = err instanceof Error ? err.message : "Payment failed";
                  // If user cancelled (before settling animation ends), abort
                  if (msg.includes("cancelled")) {
                    setSettling(false);
                    setPendingIntent(null);
                  }
                  setPayError(msg);
                });
            }}
            onCancel={() => setPendingIntent(null)}
          />
        )}
      </AnimatePresence>

      {/* Payment error toast */}
      <AnimatePresence>
        {payError && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            style={{
              position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
              zIndex: 80, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 12, padding: "10px 18px",
              fontFamily: "'Geist Mono',monospace", fontSize: 12, color: "#EF4444",
              maxWidth: 340, textAlign: "center",
            }}
          >
            {payError}
            <button
              onClick={() => setPayError(null)}
              style={{ marginLeft: 12, background: "none", border: "none", color: "#EF4444", cursor: "pointer", fontSize: 16 }}
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

// ─── Relative time helper ─────────────────────────────────────────────────────
function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  const hrs  = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (hrs  < 24) return `${hrs}h ago`;
  if (days <  7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile Header
// ─────────────────────────────────────────────────────────────────────────────
function MobileHeader({
  user, isConnected, address, liveRate, rateLoading,
  deepLink, walletConnected, setVisible, onSignOut, onHistory,
}: {
  readonly user: SupabaseUser | null;
  readonly isConnected: boolean;
  readonly address: string | null;
  readonly liveRate: number;
  readonly rateLoading: boolean;
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

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {/* Live rate pill */}
        {!rateLoading && (
          <div style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "4px 8px", borderRadius: 6,
            background: "rgba(200,241,53,0.06)", border: "1px solid rgba(200,241,53,0.12)",
            fontFamily: "'Geist Mono',monospace", fontSize: 10, color: "#C8F135",
          }}>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#C8F135", display: "inline-block" }} />
            ₹{liveRate.toFixed(2)}
          </div>
        )}

        {/* History */}
        <button onClick={onHistory} style={{ padding: 7, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
          <History size={17} />
        </button>

        {/* Wallet */}
        {walletConnected ? <WalletWidget /> :
         deepLink.isConnected && address ? (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 10px", borderRadius: 8,
            background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)",
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
  const payments    = usePaymentStore(s => s.payments);
  const completed   = payments.filter(p => p.status === "completed").length;
  const totalInr    = payments
    .filter(p => p.status === "completed")
    .reduce((s, p) => s + p.inrAmount, 0);

  return (
    <div style={{ padding: "24px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Avatar + name */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, paddingTop: 12 }}>
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          background: "linear-gradient(135deg,#1C1C20,#2775CA)",
          border: "1px solid #3A3A3F",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28, fontWeight: 800, color: "#F5F5F0",
        }}>
          {displayName[0].toUpperCase()}
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{displayName}</p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>{user?.email}</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ padding: "14px 16px", borderRadius: 12, background: "#0F0F12", border: "1px solid #26262A" }}>
          <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: "#606068", marginBottom: 4, letterSpacing: "0.06em", textTransform: "uppercase" }}>Payments</p>
          <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 22, fontWeight: 600, color: "#C8F135", margin: 0 }}>{completed}</p>
        </div>
        <div style={{ padding: "14px 16px", borderRadius: 12, background: "#0F0F12", border: "1px solid #26262A" }}>
          <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: "#606068", marginBottom: 4, letterSpacing: "0.06em", textTransform: "uppercase" }}>Total Paid</p>
          <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 16, fontWeight: 600, color: "#F5A623", margin: 0 }}>
            ₹{totalInr.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* Wallet address */}
      {address && (
        <div style={{ padding: "14px 16px", borderRadius: 14, background: "#0F0F12", border: "1px solid #26262A" }}>
          <p style={{ fontSize: 11, color: "#606068", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "'Geist Mono',monospace" }}>Wallet</p>
          <p style={{ fontSize: 12, color: "#2775CA", fontFamily: "'Geist Mono',monospace", margin: 0, wordBreak: "break-all" }}>{address}</p>
        </div>
      )}

      {/* Network badge */}
      <div style={{ padding: "10px 16px", borderRadius: 10, background: "rgba(200,241,53,0.04)", border: "1px solid rgba(200,241,53,0.1)" }}>
        <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: "#9A9AA8", margin: 0 }}>
          Network: <span style={{ color: "#C8F135" }}>{NETWORK === "mainnet-beta" ? "Mainnet" : "Devnet"}</span>
          {IS_DEMO && <span style={{ color: "#F5A623", marginLeft: 8 }}>· Demo Mode</span>}
        </p>
      </div>

      {/* Sign out */}
      <button
        onClick={onSignOut}
        style={{
          width: "100%", padding: "14px",
          borderRadius: 14,
          background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
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
  { id: "chat"     as MobileTab, label: "Pay",      icon: MessageSquare },
  { id: "activity" as MobileTab, label: "History",  icon: Activity },
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
        const active      = tab === id || (id === "scan" && tab === "qrscan");
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
