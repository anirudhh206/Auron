"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useInView } from "framer-motion";
import {
  Zap, QrCode, ArrowRight, Check, ChevronDown,
  Send, Lock, FileText, ShieldCheck, Shield,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────
export default function Home() {
  const router   = useRouter();
  const featRef  = useRef<HTMLDivElement>(null);
  const go       = () => router.push("/login");
  const scrollTo = () => featRef.current?.scrollIntoView({ behavior: "smooth" });

  return (
    <div style={{ background: "#080810" }} className="noise">
      <Nav onCTA={go} />
      <Hero onCTA={go} onScroll={scrollTo} />
      <ProofStrip />
      <Marquee />
      <div ref={featRef} />
      <QRSection />
      <ChatSection />
      <StatementSection />
      <SecuritySection />
      <CTASection onCTA={go} />
      <Footer />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Nav — invisible until scroll
// ─────────────────────────────────────────────────────────────
function Nav({ onCTA }: { readonly onCTA: () => void }) {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const h = () => setUp(window.scrollY > 32);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-between transition-all duration-500"
      style={{
        padding: "18px 48px",
        background: up ? "rgba(8,8,16,0.92)" : "transparent",
        borderBottom: up ? "1px solid rgba(201,168,76,0.08)" : "1px solid transparent",
        backdropFilter: up ? "blur(24px) saturate(160%)" : "none",
      }}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl btn-gold flex items-center justify-center">
          <Zap size={14} fill="currentColor" className="text-[#080810]" />
        </div>
        <span className="font-display font-black text-sm tracking-widest gradient-text-gold">AURON</span>
      </div>

      <div className="flex items-center gap-8">
        {["Security", "How it works", "Docs"].map(l => (
          <a key={l} href="#"
            className="text-xs font-medium transition-colors duration-200 hidden sm:block"
            style={{ color: "var(--text-muted)", letterSpacing: "0.02em" }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--auron-gold)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}>
            {l}
          </a>
        ))}
        <motion.button onClick={onCTA}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          className="btn-gold flex items-center gap-2 rounded-xl font-bold text-xs"
          style={{ padding: "10px 20px", letterSpacing: "0.01em" }}>
          Sign In <ArrowRight size={13} />
        </motion.button>
      </div>
    </motion.header>
  );
}

// ─────────────────────────────────────────────────────────────
// Hero — mouse-tracking glow · massive type · split layout
// ─────────────────────────────────────────────────────────────
function Hero({
  onCTA,
  onScroll,
}: {
  readonly onCTA: () => void;
  readonly onScroll: () => void;
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const [glow, setGlow] = useState({ x: 30, y: 50 });

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const h = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      setGlow({
        x: ((e.clientX - r.left) / r.width) * 100,
        y: ((e.clientY - r.top)  / r.height) * 100,
      });
    };
    el.addEventListener("mousemove", h, { passive: true });
    return () => el.removeEventListener("mousemove", h);
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex items-center overflow-hidden"
      style={{ padding: "140px 64px 100px" }}
    >
      {/* Mouse-following glow — the Stripe effect */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(900px circle at ${glow.x}% ${glow.y}%, rgba(201,168,76,0.11) 0%, transparent 55%)`,
          transition: "background 0.25s ease",
        }}
      />
      {/* Static ambient glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-48 -left-24 w-[900px] h-[700px] rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(201,168,76,0.07) 0%, transparent 60%)", filter: "blur(120px)" }} />
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] rounded-full"
          style={{ background: "radial-gradient(ellipse, rgba(124,58,237,0.05) 0%, transparent 60%)", filter: "blur(100px)" }} />
      </div>
      {/* Subtle grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.018]"
        style={{ backgroundImage: "linear-gradient(rgba(201,168,76,1) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,1) 1px, transparent 1px)", backgroundSize: "72px 72px" }} />

      <div className="relative z-10 w-full max-w-[1440px] mx-auto grid lg:grid-cols-[1fr_1fr] gap-24 xl:gap-32 items-center">

        {/* ── Left ── */}
        <div className="space-y-10">

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.6 }}
            className="inline-flex items-center gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium" style={{ color: "var(--text-muted)", letterSpacing: "0.04em" }}>
              SOLANA · CLAUDE AI · LIVE ON DEVNET
            </span>
          </motion.div>

          {/* Headline — each word slides from below independently */}
          <div>
            {(["Scan it.", "Say it.", "Done."] as const).map((line, i) => (
              <div key={line} style={{ overflow: "hidden", lineHeight: 1 }}>
                <motion.h1
                  initial={{ y: "110%" }}
                  animate={{ y: "0%" }}
                  transition={{ delay: 0.15 + i * 0.1, duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
                  className={`block font-display font-black ${i === 1 ? "" : "gradient-text-gold-hero"}`}
                  style={{
                    fontSize: "clamp(4.2rem, 8.5vw, 9rem)",
                    letterSpacing: "-0.04em",
                    lineHeight: "0.95",
                    paddingBottom: "0.06em",
                    color: i === 1 ? "#F0EEE8" : undefined,
                  }}
                >
                  {line}
                </motion.h1>
              </div>
            ))}
          </div>

          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.52, duration: 0.7 }}
            style={{
              color: "var(--text-secondary)",
              fontSize: "1.125rem",
              lineHeight: "1.7",
              maxWidth: "440px",
              letterSpacing: "-0.01em",
            }}>
            Pay any merchant by scanning their QR code. Send money, save agreements,
            lock savings — just say what you want. Auron handles the blockchain.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.62, duration: 0.6 }}
            className="flex items-center gap-4">
            <motion.button onClick={onCTA}
              whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
              className="btn-gold animate-btn-pulse flex items-center gap-2.5 rounded-2xl font-bold"
              style={{ padding: "16px 32px", fontSize: "15px", letterSpacing: "-0.01em" }}>
              <QrCode size={18} />
              Start for free
              <ArrowRight size={16} />
            </motion.button>
            <button onClick={onScroll}
              className="text-sm font-medium transition-all duration-200 flex items-center gap-1.5"
              style={{ color: "var(--text-muted)", letterSpacing: "-0.01em" }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--auron-gold)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; }}>
              Watch it in action <ChevronDown size={14} />
            </button>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
            className="flex items-center gap-6 pt-2">
            {["Scan any UPI QR", "~400ms finality", "₹0 transaction fee", "Phantom wallet"].map(t => (
              <div key={t} className="flex items-center gap-1.5" style={{ color: "var(--text-muted)", fontSize: "12px" }}>
                <Check size={11} style={{ color: "var(--success)" }} />
                {t}
              </div>
            ))}
          </motion.div>
        </div>

        {/* ── Right: Product window ── */}
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          className="hidden lg:flex items-center justify-center"
        >
          <ProductWindow />
        </motion.div>
      </div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 0.35 }} transition={{ delay: 2.5 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
      >
        <motion.div animate={{ y: [0, 5, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}>
          <ChevronDown size={18} style={{ color: "var(--text-muted)" }} />
        </motion.div>
      </motion.div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Product window — macOS-style, high fidelity
// ─────────────────────────────────────────────────────────────
function ProductWindow() {
  const qr = Array.from({ length: 64 }, (_, i) => {
    const x = i % 8, y = Math.floor(i / 8);
    if ((x < 2 && y < 2)||(x > 5 && y < 2)||(x < 2 && y > 5)) return true;
    return ((i * 2654435761) >>> 28) % 3 !== 0;
  });

  return (
    <div className="relative w-full max-w-[520px]">
      {/* Glow behind */}
      <div className="absolute -inset-8 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 60% at 55% 45%, rgba(201,168,76,0.14) 0%, transparent 65%)", filter: "blur(40px)" }} />

      {/* Window */}
      <div className="relative rounded-[20px] overflow-hidden"
        style={{
          border: "1px solid rgba(255,255,255,0.09)",
          background: "rgba(11,11,20,0.97)",
          boxShadow: "0 60px 160px rgba(0,0,0,0.9), 0 0 0 1px rgba(201,168,76,0.06), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}>

        {/* Traffic lights bar */}
        <div className="flex items-center gap-2 px-5 h-11"
          style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          {["#FF5F57","#FFBD2E","#28CA41"].map(c => (
            <div key={c} className="w-3 h-3 rounded-full" style={{ background: c, opacity: 0.85 }} />
          ))}
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-2 px-3 py-1 rounded-md"
              style={{ background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.055)" }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: "rgba(201,168,76,0.6)" }} />
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.22)", fontFamily: "var(--font-dm-sans)" }}>
                auron.xyz/app
              </span>
            </div>
          </div>
        </div>

        {/* App chrome */}
        <div style={{ padding: "20px" }}>

          {/* App header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl btn-gold flex items-center justify-center">
                <Zap size={12} fill="currentColor" className="text-[#080810]" />
              </div>
              <span className="font-display font-bold text-sm gradient-text-gold" style={{ letterSpacing: "-0.01em" }}>AURON</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl px-3 py-1.5"
              style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.18)" }}>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span style={{ fontSize: "11px", color: "#C9A84C", fontWeight: 600 }}>0.84 SOL · 102 USDC</span>
            </div>
          </div>

          {/* Messages */}
          <div className="space-y-3 mb-4">
            {/* User */}
            <div className="flex justify-end">
              <div className="chat-bubble-user flex items-center gap-1.5" style={{ padding: "8px 14px", fontSize: "12px", fontWeight: 600 }}>
                <QrCode size={11} /> Scan Swiggy QR
              </div>
            </div>
            {/* AI */}
            <div className="flex gap-2 items-start">
              <div className="w-6 h-6 rounded-full btn-gold flex items-center justify-center shrink-0 mt-0.5">
                <Zap size={10} fill="currentColor" className="text-[#080810]" />
              </div>
              <div className="chat-bubble-assistant" style={{ padding: "8px 14px", fontSize: "12px", color: "var(--text-secondary)" }}>
                Pay ₹450 to Swiggy? That&apos;s 5.41 USDC on Solana.
              </div>
            </div>

            {/* Confirm card */}
            <div className="ml-8 rounded-xl" style={{ background: "rgba(201,168,76,0.05)", border: "1px solid rgba(201,168,76,0.22)", padding: "14px" }}>
              <p style={{ fontSize: "9px", fontWeight: 700, color: "#C9A84C", letterSpacing: "0.08em", marginBottom: "10px" }}>CONFIRM PAYMENT</p>
              {[["Merchant","Swiggy"],["Amount","₹450 · 5.41 USDC"],["Network fee","< $0.001"]].map(([k,v]) => (
                <div key={k} className="flex justify-between items-center mb-2">
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{k}</span>
                  <span style={{ fontSize: "11px", color: "#F0EEE8", fontWeight: 600 }}>{v}</span>
                </div>
              ))}
              <div className="rounded-lg flex items-center justify-center gap-1.5 mt-3 btn-gold"
                style={{ padding: "9px", fontSize: "11px", fontWeight: 700 }}>
                <Check size={11} /> Confirm in Phantom
              </div>
            </div>

            {/* QR visual */}
            <div className="rounded-xl flex items-center gap-4"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", padding: "14px" }}>
              <div className="relative w-[72px] h-[72px] shrink-0">
                {["top-0 left-0 border-t-2 border-l-2 rounded-tl-lg","top-0 right-0 border-t-2 border-r-2 rounded-tr-lg",
                  "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-lg","bottom-0 right-0 border-b-2 border-r-2 rounded-br-lg"
                ].map((cls,i) => (
                  <div key={i} className={`absolute w-4 h-4 ${cls}`} style={{ borderColor: "#C9A84C" }} />
                ))}
                <div className="absolute inset-2.5 grid grid-cols-8 gap-[1.5px]">
                  {qr.map((f,i) => (
                    <div key={i} className="rounded-[1px]" style={{ background: f ? "rgba(201,168,76,0.55)" : "transparent", aspectRatio: "1" }} />
                  ))}
                </div>
                <motion.div animate={{ y: [2,66,2] }} transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute left-2 right-2 h-[1.5px]"
                  style={{ background: "linear-gradient(90deg,transparent,#C9A84C,#F0D080,#C9A84C,transparent)", boxShadow: "0 0 6px rgba(201,168,76,0.7)" }} />
              </div>
              <div>
                <p style={{ fontSize: "11px", fontWeight: 600, color: "#F0EEE8", marginBottom: "3px" }}>Swiggy · merchant@upi</p>
                <p style={{ fontSize: "10px", color: "var(--text-muted)", marginBottom: "4px" }}>UPI QR detected</p>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "#C9A84C" }}>₹450.00</p>
              </div>
            </div>

            {/* Done */}
            <div className="flex gap-2 items-start">
              <div className="w-6 h-6 rounded-full btn-gold flex items-center justify-center shrink-0 mt-0.5">
                <Zap size={10} fill="currentColor" className="text-[#080810]" />
              </div>
              <div className="chat-bubble-assistant" style={{ padding: "8px 14px", fontSize: "12px", color: "var(--text-secondary)" }}>
                <span style={{ color: "var(--success)" }}>✓</span> Done. ₹450 confirmed in 412ms.
              </div>
            </div>
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 rounded-xl" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", padding: "10px 14px" }}>
            <span style={{ flex: 1, fontSize: "11px", color: "rgba(255,255,255,0.18)" }}>Type what you want to do…</span>
            <QrCode size={13} style={{ color: "rgba(201,168,76,0.45)" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Proof strip — one thin elegant line
// ─────────────────────────────────────────────────────────────
function ProofStrip() {
  const items = ["~400ms transaction finality", "< $0.001 network fee", "0 seed phrases", "300M+ QR codes supported", "Phantom · Backpack · Solflare"];
  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "18px 64px", background: "rgba(255,255,255,0.012)" }}>
      <div className="flex items-center justify-center flex-wrap gap-x-10 gap-y-2">
        {items.map((item, i) => (
          <div key={item} className="flex items-center gap-3">
            {i > 0 && <div className="w-px h-3 hidden sm:block" style={{ background: "rgba(255,255,255,0.08)" }} />}
            <span style={{ fontSize: "12px", color: "var(--text-muted)", letterSpacing: "0.01em" }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Marquee
// ─────────────────────────────────────────────────────────────
function Marquee() {
  const items = ["Google Pay","PhonePe","Paytm","Swiggy","Zomato","Amazon Pay","Flipkart","Ola","BHIM","Razorpay","Any UPI Terminal","Cashfree","MobiKwik","Juspay"];
  const doubled = [...items, ...items];
  return (
    <div style={{ padding: "28px 0", overflow: "hidden", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
      <div className="flex items-center gap-3 px-16 mb-3">
        <span style={{ fontSize: "10px", letterSpacing: "0.1em", color: "var(--text-muted)", textTransform: "uppercase", whiteSpace: "nowrap" }}>Accepted at</span>
        <div style={{ height: "1px", flex: 1, background: "rgba(255,255,255,0.05)" }} />
      </div>
      <div className="animate-marquee flex gap-12" style={{ paddingLeft: "64px" }}>
        {doubled.map((item, i) => (
          <div key={i} className="flex items-center gap-2.5 shrink-0">
            <div className="w-1 h-1 rounded-full" style={{ background: "rgba(201,168,76,0.5)" }} />
            <span style={{ fontSize: "13px", color: "var(--text-muted)", whiteSpace: "nowrap", fontWeight: 500 }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// QR Feature — full bleed, dominant visual
// ─────────────────────────────────────────────────────────────
function QRSection() {
  const ref   = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} style={{ padding: "160px 0", background: "rgba(201,168,76,0.02)", borderTop: "1px solid rgba(201,168,76,0.06)" }}>
      <div className="max-w-[1440px] mx-auto grid lg:grid-cols-2 items-center" style={{ gap: "80px", padding: "0 64px" }}>

        {/* Left: QR visual */}
        <motion.div initial={{ opacity: 0, x: -32 }} animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}>
          <QRVisual />
        </motion.div>

        {/* Right: text */}
        <motion.div initial={{ opacity: 0, x: 32 }} animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-10">

          <div className="space-y-5">
            <p style={{ fontSize: "11px", letterSpacing: "0.1em", color: "var(--auron-gold)", textTransform: "uppercase", fontWeight: 700 }}>
              Flagship feature
            </p>
            <h2 className="font-display font-black" style={{ fontSize: "clamp(2.2rem, 4vw, 3.6rem)", letterSpacing: "-0.03em", color: "#F0EEE8", lineHeight: 1.05 }}>
              Every UPI QR is now a Solana payment terminal.
            </h2>
            <p style={{ fontSize: "16px", lineHeight: 1.75, color: "var(--text-secondary)", maxWidth: "480px", letterSpacing: "-0.01em" }}>
              300 million merchants already have a QR code. Auron makes every single one work with crypto — without the merchant changing anything. They receive INR instantly. The blockchain is invisible.
            </p>
          </div>

          <div className="space-y-6" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "32px" }}>
            {[
              { stat: "~400ms", label: "transaction finality on Solana" },
              { stat: "₹0",     label: "transaction fee for the paying user" },
              { stat: "300M+",  label: "merchants whose QR already works" },
            ].map(({ stat, label }) => (
              <div key={stat} className="flex items-baseline gap-5">
                <span className="font-display font-black gradient-text-gold shrink-0"
                  style={{ fontSize: "clamp(2.4rem, 4vw, 3.2rem)", letterSpacing: "-0.04em" }}>
                  {stat}
                </span>
                <span style={{ fontSize: "14px", color: "var(--text-muted)", letterSpacing: "-0.01em" }}>{label}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function QRVisual() {
  const dots = Array.from({ length: 100 }, (_, i) => {
    const x = i % 10, y = Math.floor(i / 10);
    if ((x < 3 && y < 3)||(x > 6 && y < 3)||(x < 3 && y > 6)) return true;
    return ((i * 2654435761) >>> 28) % 3 !== 0;
  });

  return (
    <div className="relative flex items-center justify-center" style={{ minHeight: "480px" }}>
      {/* Glow */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 60% at 50% 50%, rgba(201,168,76,0.1) 0%, transparent 70%)", filter: "blur(30px)" }} />

      <div className="relative flex flex-col items-center gap-8">
        {/* Frame */}
        <div className="relative" style={{ width: "240px", height: "240px" }}>
          {[
            "top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-2xl",
            "top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-2xl",
            "bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-2xl",
            "bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-2xl",
          ].map((cls, i) => (
            <div key={i} className={`absolute w-12 h-12 ${cls}`} style={{ borderColor: "#C9A84C" }} />
          ))}
          {/* QR dots */}
          <div className="absolute" style={{ inset: "24px", display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: "3px" }}>
            {dots.map((f, i) => (
              <div key={i} style={{ background: f ? "rgba(201,168,76,0.48)" : "transparent", aspectRatio: "1", borderRadius: "2px" }} />
            ))}
          </div>
          {/* Scan line */}
          <motion.div
            animate={{ y: [8, 220, 8] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="absolute left-5 right-5"
            style={{ height: "2px", background: "linear-gradient(90deg, transparent, #C9A84C, #F5E098, #C9A84C, transparent)", boxShadow: "0 0 12px rgba(201,168,76,0.8)" }}
          />
        </div>

        {/* Detection badge */}
        <motion.div
          animate={{ opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          className="flex items-center gap-3 rounded-2xl"
          style={{ background: "rgba(201,168,76,0.07)", border: "1px solid rgba(201,168,76,0.22)", padding: "14px 24px" }}>
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <div>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "#F0EEE8" }}>UPI QR Detected</p>
            <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>Swiggy · merchant@upi · ₹450</p>
          </div>
          <ArrowRight size={16} style={{ color: "#C9A84C" }} />
        </motion.div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Chat Feature — reversed, editorial
// ─────────────────────────────────────────────────────────────
function ChatSection() {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  const msgs = [
    { user: "Send ₹500 to Priya",           ai: "Sending 6.01 USDC to Priya on Solana. Confirm?" },
    { user: "Lock ₹2,000 for 3 months",     ai: "Savings lock created. Unlocks Aug 2, 2026." },
    { user: "Arjun owes me ₹1,500",         ai: "Agreement stamped on Solana. Permanent record created." },
    { user: "Prove I own this photo",        ai: "SHA-256 hash timestamped on-chain. You have proof." },
  ];

  return (
    <section ref={ref} style={{ padding: "160px 0", background: "#080810", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
      <div className="max-w-[1440px] mx-auto grid lg:grid-cols-2 items-center" style={{ gap: "80px", padding: "0 64px" }}>

        {/* Left: text */}
        <motion.div initial={{ opacity: 0, x: -32 }} animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-10">

          <div className="space-y-5">
            <p style={{ fontSize: "11px", letterSpacing: "0.1em", color: "var(--auron-gold)", textTransform: "uppercase", fontWeight: 700 }}>
              Conversational interface
            </p>
            <h2 className="font-display font-black" style={{ fontSize: "clamp(2.2rem, 4vw, 3.6rem)", letterSpacing: "-0.03em", color: "#F0EEE8", lineHeight: 1.05 }}>
              Every Solana action.<br />One sentence.
            </h2>
            <p style={{ fontSize: "16px", lineHeight: 1.75, color: "var(--text-secondary)", maxWidth: "460px", letterSpacing: "-0.01em" }}>
              Transfers, savings locks, agreement stamps, ownership proofs — every primitive Solana offers, accessible to anyone who can type a text message.
            </p>
          </div>

          <div className="space-y-4" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "32px" }}>
            {[
              { icon: Send,        label: "Send money",      sub: "SOL or USDC in under a second" },
              { icon: Lock,        label: "Lock savings",    sub: "Time-locked on Solana" },
              { icon: FileText,    label: "Stamp agreements",sub: "Immutable via Solana memo program" },
              { icon: ShieldCheck, label: "Prove ownership", sub: "SHA-256 hash, timestamped forever" },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-center gap-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(201,168,76,0.07)", border: "1px solid rgba(201,168,76,0.14)" }}>
                  <Icon size={15} style={{ color: "#C9A84C" }} />
                </div>
                <div>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#F0EEE8" }}>{label}</span>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "8px" }}>{sub}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Right: chat window */}
        <motion.div initial={{ opacity: 0, x: 32 }} animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}>
          <div className="relative">
            <div className="absolute -inset-6 pointer-events-none"
              style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(124,58,237,0.07) 0%, transparent 65%)", filter: "blur(32px)" }} />
            <div className="relative rounded-[20px] overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(11,11,20,0.97)", boxShadow: "0 40px 120px rgba(0,0,0,0.85)" }}>
              {/* Title bar */}
              <div className="flex items-center gap-2 px-5 h-11"
                style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                {["#FF5F57","#FFBD2E","#28CA41"].map(c => (
                  <div key={c} className="w-3 h-3 rounded-full" style={{ background: c, opacity: 0.85 }} />
                ))}
                <span className="flex-1 text-center" style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)" }}>
                  Auron — Chat
                </span>
              </div>
              <div style={{ padding: "20px" }} className="space-y-3">
                {msgs.map(({ user, ai }, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-end">
                      <div className="chat-bubble-user" style={{ padding: "8px 14px", fontSize: "12px", fontWeight: 600 }}>{user}</div>
                    </div>
                    <div className="flex gap-2 items-start">
                      <div className="w-5 h-5 rounded-full btn-gold flex items-center justify-center shrink-0 mt-0.5">
                        <Zap size={9} fill="currentColor" className="text-[#080810]" />
                      </div>
                      <div className="chat-bubble-assistant" style={{ padding: "8px 14px", fontSize: "12px", color: "var(--text-secondary)" }}>
                        <Check size={10} style={{ color: "var(--success)", display: "inline", marginRight: "4px" }} />
                        {ai}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-2 rounded-xl mt-2"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", padding: "10px 14px" }}>
                  <span style={{ flex: 1, fontSize: "11px", color: "rgba(255,255,255,0.18)" }}>Type what you want to do…</span>
                  <QrCode size={12} style={{ color: "rgba(201,168,76,0.4)" }} />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Statement — pure editorial typography (Stripe "Billions" moment)
// ─────────────────────────────────────────────────────────────
function StatementSection() {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} style={{ padding: "160px 64px", background: "rgba(201,168,76,0.025)", borderTop: "1px solid rgba(201,168,76,0.06)", borderBottom: "1px solid rgba(201,168,76,0.06)" }}>
      <div className="max-w-[1200px] mx-auto">
        <div className="flex items-start gap-20 flex-col lg:flex-row">

          <motion.p initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}}
            transition={{ duration: 0.7 }}
            style={{ fontSize: "11px", letterSpacing: "0.1em", color: "var(--auron-gold)", textTransform: "uppercase", fontWeight: 700, paddingTop: "8px", minWidth: "120px" }}>
            The principle
          </motion.p>

          <div className="flex-1">
            {[
              "The blockchain is invisible.",
              "The receipt is permanent.",
              "The barrier is zero.",
            ].map((line, i) => (
              <div key={line} style={{ overflow: "hidden" }}>
                <motion.p
                  initial={{ y: "110%" }}
                  animate={inView ? { y: "0%" } : {}}
                  transition={{ delay: 0.1 + i * 0.12, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  className="font-display font-black"
                  style={{
                    fontSize: "clamp(2.2rem, 4.5vw, 4.5rem)",
                    letterSpacing: "-0.04em",
                    lineHeight: "1.1",
                    color: i === 0 ? "#F0EEE8" : i === 1 ? "rgba(240,238,232,0.6)" : "rgba(240,238,232,0.3)",
                  }}>
                  {line}
                </motion.p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Security — two column, sticky heading
// ─────────────────────────────────────────────────────────────
function SecuritySection() {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  const points = [
    { title: "No seed phrases",      desc: "Your Phantom wallet is your key. Losing your phone doesn't mean losing your money." },
    { title: "Intent mirror",        desc: "You see exactly what will happen — in plain English — before anything executes." },
    { title: "Scam detector",        desc: "Urgency in a message triggers automatic slowdown. Every scam uses urgency. We remove it." },
    { title: "Smart limits",         desc: "You set the ceiling for instant sends. Above it — extra confirmation required." },
    { title: "Closed signing",       desc: "Only Auron can prompt your wallet. No external site can ever trigger a transaction." },
    { title: "Daily spend cap",      desc: "A hard ceiling on daily spend. Even in the worst case, exposure is bounded." },
  ];

  return (
    <section ref={ref} style={{ padding: "160px 64px", background: "#080810", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
      <div className="max-w-[1200px] mx-auto grid lg:grid-cols-[380px_1fr] gap-24 items-start">

        <motion.div initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="lg:sticky lg:top-36 space-y-6">
          <p style={{ fontSize: "11px", letterSpacing: "0.1em", color: "var(--auron-gold)", textTransform: "uppercase", fontWeight: 700 }}>Security</p>
          <h2 className="font-display font-black" style={{ fontSize: "clamp(2rem, 3.5vw, 3rem)", letterSpacing: "-0.03em", color: "#F0EEE8", lineHeight: 1.1 }}>
            Built for people who don&apos;t think about security.
          </h2>
          <p style={{ fontSize: "15px", lineHeight: 1.7, color: "var(--text-secondary)", letterSpacing: "-0.01em" }}>
            Most security tools assume you know what a seed phrase is. Ours assume you don&apos;t — and that&apos;s the harder design problem.
          </p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.18)" }}>
              <Shield size={18} style={{ color: "#C9A84C" }} />
            </div>
            <div>
              <p style={{ fontSize: "13px", fontWeight: 700, color: "#F0EEE8" }}>6 layers, every transaction</p>
              <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>All six run before anything executes</p>
            </div>
          </div>
        </motion.div>

        <div>
          {points.map((p, i) => (
            <motion.div key={p.title}
              initial={{ opacity: 0, x: 20 }} animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.55, delay: i * 0.08 }}
              className="flex gap-5 py-7"
              style={{ borderBottom: i < points.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: "rgba(201,168,76,0.09)", border: "1px solid rgba(201,168,76,0.18)" }}>
                <Check size={11} style={{ color: "#C9A84C" }} />
              </div>
              <div>
                <p style={{ fontSize: "14px", fontWeight: 600, color: "#F0EEE8", marginBottom: "4px", letterSpacing: "-0.01em" }}>{p.title}</p>
                <p style={{ fontSize: "13px", lineHeight: 1.65, color: "var(--text-secondary)", letterSpacing: "-0.01em" }}>{p.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// CTA — full width, dramatic
// ─────────────────────────────────────────────────────────────
function CTASection({ onCTA }: { readonly onCTA: () => void }) {
  const ref    = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} className="relative overflow-hidden"
      style={{ padding: "180px 64px", background: "rgba(201,168,76,0.025)", borderTop: "1px solid rgba(201,168,76,0.08)" }}>
      {/* Glow */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 80% 70% at 50% 50%, rgba(201,168,76,0.07) 0%, transparent 65%)" }} />

      <div className="relative max-w-[900px] mx-auto text-center">
        <motion.div initial={{ opacity: 0, y: 28 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-8">

          <div style={{ overflow: "hidden" }}>
            <motion.h2
              initial={{ y: "80%" }} animate={inView ? { y: "0%" } : {}}
              transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
              className="font-display font-black"
              style={{ fontSize: "clamp(3rem, 6.5vw, 6.5rem)", letterSpacing: "-0.04em", color: "#F0EEE8", lineHeight: "0.95" }}>
              8 billion people deserve<br />
              <span className="gradient-text-gold">access to this.</span>
            </motion.h2>
          </div>

          <motion.p initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ delay: 0.2 }}
            style={{ fontSize: "18px", color: "var(--text-secondary)", letterSpacing: "-0.01em" }}>
            Most of them just need it to work like a text message.
          </motion.p>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.3 }}
            className="flex flex-col items-center gap-4">
            <motion.button onClick={onCTA} whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.97 }}
              className="btn-gold animate-btn-pulse flex items-center gap-3 rounded-2xl font-bold"
              style={{ padding: "18px 40px", fontSize: "17px", letterSpacing: "-0.01em" }}>
              <Zap size={20} fill="currentColor" />
              Create your Auron account
              <ArrowRight size={18} />
            </motion.button>
            <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              Free. Connect Phantom. Start in 10 seconds.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// Footer — ultra minimal
// ─────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ padding: "32px 64px", borderTop: "1px solid rgba(255,255,255,0.05)", background: "#080810" }}>
      <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-8 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-xl btn-gold flex items-center justify-center">
            <Zap size={12} fill="currentColor" className="text-[#080810]" />
          </div>
          <span className="font-display font-black text-sm gradient-text-gold" style={{ letterSpacing: "0.04em" }}>AURON</span>
        </div>
        <div className="flex items-center gap-8">
          {["About","Security","Docs","Contact"].map(l => (
            <a key={l} href="#" style={{ fontSize: "12px", color: "var(--text-muted)", textDecoration: "none", letterSpacing: "0.01em" }}
              className="transition-colors duration-200 hover:text-gold">{l}</a>
          ))}
        </div>
        <p style={{ fontSize: "11px", color: "var(--text-muted)", letterSpacing: "0.01em" }}>
          © 2026 Auron · Solana · Scan it. Say it. Done.
        </p>
      </div>
    </footer>
  );
}
