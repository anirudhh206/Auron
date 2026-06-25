"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useStore } from "@/store/useStore";
import { Eye, EyeOff, Check, ArrowRight, Loader2, ChevronRight, Phone, ShieldCheck } from "lucide-react";
import AuronLogo from "@/components/AuronLogo";

// ── Types ─────────────────────────────────────────────────────
type AuthMode = "signin" | "signup";
type AuthStep = "auth" | "pin" | "pin-confirm" | "phone" | "otp" | "welcome";

// ── Phone normalisation ───────────────────────────────────────
function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith("091")) return `+${digits.slice(1)}`;
  if (raw.trim().startsWith("+") && digits.length >= 7) return `+${digits}`;
  return null;
}

// ── Carousel items ────────────────────────────────────────────
const CAROUSEL_ITEMS = [
  {
    action: "You sent ₹500 to Priya Sharma",
    detail: "Permanently recorded on Solana blockchain",
    time: "Apr 12, 2026 — 3:42 PM",
  },
  {
    action: "Your savings are locked until March 2026",
    detail: "12% APY accruing automatically",
    time: "Jan 3, 2026 — 11:05 AM",
  },
  {
    action: "You proved ownership of this document",
    detail: "Timestamped hash — immutable proof",
    time: "Apr 21, 2026 — 9:17 AM",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const { setPrefs } = useStore();

  const [step, setStep] = useState<AuthStep>("auth");
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [username, setUsername] = useState("");

  // PIN state
  const [pin, setPin] = useState(["", "", "", ""]);
  const [pinConfirm, setPinConfirm] = useState(["", "", "", ""]);
  const pinRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];
  const pinConfirmRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Phone + OTP state
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneE164, setPhoneE164] = useState("");
  const [otpDigits, setOtpDigits] = useState(["", "", "", "", "", ""]);
  const [otpResendCooldown, setOtpResendCooldown] = useState(0);
  const otpRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  // Redirect if already logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push("/app");
    });
  }, [router, supabase]);

  // Show error from OAuth callback (?error=auth_failed)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err === "auth_failed") {
      setError("Google sign-in failed. Please try again or use email.");
    }
  }, []);

  // Carousel auto-rotate
  useEffect(() => {
    const t = setInterval(() => setCarouselIdx(i => (i + 1) % 3), 3500);
    return () => clearInterval(t);
  }, []);

  // OTP resend cooldown countdown
  useEffect(() => {
    if (otpResendCooldown <= 0) return;
    const t = setInterval(() => setOtpResendCooldown(n => n - 1), 1000);
    return () => clearInterval(t);
  }, [otpResendCooldown]);

  // ── Auth handlers ─────────────────────────────────────────
  async function handleGoogle() {
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/api/auth/callback` },
    });
    if (error) { setError(error.message); setLoading(false); }
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
      if (!data.session) {
        setError(`Check your inbox — we sent a confirmation link to ${email}. Please verify your email before signing in.`);
        setLoading(false);
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
    }

    setLoading(false);
    setStep("pin");
    setTimeout(() => pinRefs[0].current?.focus(), 100);
  }

  // ── PIN handlers ──────────────────────────────────────────
  function handlePinInput(
    idx: number,
    value: string,
    refs: React.RefObject<HTMLInputElement | null>[],
    setter: React.Dispatch<React.SetStateAction<string[]>>
  ) {
    if (!/^\d?$/.test(value)) return;
    setter(prev => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
    if (value && idx < 3) refs[idx + 1].current?.focus();
  }

  function handlePinKeyDown(
    e: React.KeyboardEvent,
    idx: number,
    refs: React.RefObject<HTMLInputElement | null>[]
  ) {
    if (e.key === "Backspace" && idx > 0) refs[idx - 1].current?.focus();
  }

  function handlePinSubmit() {
    if (pin.some(d => d === "")) { setError("Enter all 4 digits."); return; }
    setError("");
    setStep("pin-confirm");
    setTimeout(() => pinConfirmRefs[0].current?.focus(), 100);
  }

  async function handlePinConfirm() {
    if (pinConfirm.join("") !== pin.join("")) {
      setError("PINs don't match. Try again.");
      setPinConfirm(["", "", "", ""]);
      setTimeout(() => pinConfirmRefs[0].current?.focus(), 100);
      return;
    }

    setLoading(true);
    setError("");

    const res = await fetch("/api/hash-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: pin.join("") }),
    });

    if (!res.ok) {
      setError("Failed to secure PIN. Please try again.");
      setLoading(false);
      return;
    }

    const { hash } = await res.json();
    const { data: { user } } = await supabase.auth.getUser();
    const base = user?.user_metadata?.full_name?.split(" ")[0]?.toLowerCase()
      ?? user?.email?.split("@")[0]?.toLowerCase()
      ?? "user";
    setUsername(`${base}.init`);
    setPrefs({ hasOnboarded: true, pin: hash });
    setLoading(false);

    // Only show phone step for new sign-ups — sign-in goes straight to app
    if (mode === "signup") {
      setStep("phone");
    } else {
      setStep("welcome");
    }
  }

  // ── Phone / OTP handlers ──────────────────────────────────

  async function handleSendOTP() {
    setError("");
    const e164 = normalisePhone(phoneInput);
    if (!e164) {
      setError("Enter a valid Indian mobile number (10 digits).");
      return;
    }

    setLoading(true);
    // Uses Supabase's built-in phone_change flow — sends OTP to the number
    const { error } = await supabase.auth.updateUser({ phone: e164 });
    setLoading(false);

    if (error) {
      // Surface friendly messages for common errors
      if (error.message.toLowerCase().includes("rate")) {
        setError("Too many attempts. Please wait a minute and try again.");
      } else if (error.message.toLowerCase().includes("invalid")) {
        setError("Invalid phone number. Check and try again.");
      } else {
        setError(error.message);
      }
      return;
    }

    setPhoneE164(e164);
    setOtpDigits(["", "", "", "", "", ""]);
    setOtpResendCooldown(60);
    setStep("otp");
    setTimeout(() => otpRefs[0].current?.focus(), 100);
  }

  async function handleVerifyOTP() {
    const token = otpDigits.join("");
    if (token.length < 6) { setError("Enter the full 6-digit code."); return; }

    setLoading(true);
    setError("");

    // Verify the OTP with Supabase
    const { error: otpErr } = await supabase.auth.verifyOtp({
      phone: phoneE164,
      token,
      type: "phone_change",
    });

    if (otpErr) {
      setLoading(false);
      if (otpErr.message.toLowerCase().includes("expired")) {
        setError("Code expired. Tap Resend to get a new one.");
      } else if (otpErr.message.toLowerCase().includes("invalid")) {
        setError("Incorrect code. Please check and try again.");
      } else {
        setError(otpErr.message);
      }
      return;
    }

    // OTP verified — persist phone to our users table
    const res = await fetch("/api/auth/verify-phone", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: phoneE164 }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string };
      setError(data.error ?? "Failed to save phone. Please try again.");
      return;
    }

    setStep("welcome");
  }

  async function handleResendOTP() {
    if (otpResendCooldown > 0) return;
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ phone: phoneE164 });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setOtpDigits(["", "", "", "", "", ""]);
      setOtpResendCooldown(60);
      setTimeout(() => otpRefs[0].current?.focus(), 100);
    }
  }

  function handleOtpInput(idx: number, value: string) {
    if (!/^\d?$/.test(value)) return;
    setOtpDigits(prev => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
    if (value && idx < 5) otpRefs[idx + 1].current?.focus();
  }

  function handleOtpKeyDown(e: React.KeyboardEvent, idx: number) {
    if (e.key === "Backspace" && !otpDigits[idx] && idx > 0) {
      otpRefs[idx - 1].current?.focus();
    }
  }

  // Auto-submit when all 6 digits filled
  useEffect(() => {
    if (step === "otp" && otpDigits.every(d => d !== "")) {
      handleVerifyOTP();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpDigits, step]);

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex" style={{ background: "var(--bg-base)" }}>

      {/* ── Left panel — brand story ─────────────────────── */}
      <div className="login-left-panel hidden lg:flex lg:w-[45%] flex-col justify-between p-10 relative overflow-hidden">
        <div className="absolute bottom-0 left-0 right-0 h-64 pointer-events-none" />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <AuronLogo size={36} showText textSize={18} />
        </div>

        {/* Carousel */}
        <div className="relative z-10 flex-1 flex items-center justify-center py-12">
          <div className="w-full max-w-sm">
            <p className="text-xs uppercase tracking-widest font-medium mb-6 text-auron-gold-dim">
              What Auron does
            </p>
            <AnimatePresence mode="wait">
              <motion.div
                key={carouselIdx}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="login-carousel-card rounded-2xl p-5"
              >
                <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gold-dim/10">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-success/15 border border-success/25">
                    <Check size={15} className="text-success" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-text-primary">What just happened</p>
                    <p className="text-[10px] text-text-muted">Confirmed on Solana blockchain</p>
                  </div>
                </div>
                <p className="text-sm font-medium mb-4 text-text-primary">
                  {CAROUSEL_ITEMS[carouselIdx].action}
                </p>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Recorded on</span>
                    <span className="text-text-secondary">Auron · Solana</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Time</span>
                    <span className="text-text-secondary">{CAROUSEL_ITEMS[carouselIdx].time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Can be altered?</span>
                    <span className="font-semibold text-success">No. Ever.</span>
                  </div>
                </div>
                <p className="text-[10px] mt-4 pt-3 italic text-text-muted border-t border-gold-dim/5">
                  {CAROUSEL_ITEMS[carouselIdx].detail}
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="flex justify-center gap-2 mt-5">
              {CAROUSEL_ITEMS.map((_, i) => (
                <button
                  key={`carousel-dot-${i}`}
                  onClick={() => setCarouselIdx(i)}
                  className={`carousel-dot ${i === carouselIdx ? "active" : ""} h-1.5`}
                  aria-label={`Go to carousel item ${i + 1}`}
                  aria-current={i === carouselIdx ? "page" : undefined}
                />
              ))}
            </div>
          </div>
        </div>

        <p className="relative z-10 text-sm italic text-text-muted">
          &quot;The blockchain was invisible. That was the point.&quot;
        </p>
      </div>

      {/* ── Right panel — auth form ──────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-bg-surface">
        <div className="w-full max-w-md">
          <AnimatePresence mode="wait">

            {/* ── Step: Auth form ────────────────────────── */}
            {step === "auth" && (
              <motion.div
                key="auth"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="flex items-center gap-2 mb-8 lg:hidden">
                  <AuronLogo size={30} showText textSize={15} />
                </div>

                <h1 className="font-display font-bold text-3xl sm:text-4xl mb-2 text-text-primary">
                  Welcome to Auron
                </h1>
                <p className="text-sm mb-8 text-text-secondary">
                  Sign in or create your account in 10 seconds.
                </p>

                <motion.button
                  onClick={handleGoogle}
                  disabled={loading}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="login-button-secondary w-full flex items-center justify-center gap-3 py-3.5 rounded-xl font-semibold text-sm mb-2"
                  aria-label="Continue with Google"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <GoogleIcon />}
                  Continue with Google
                </motion.button>
                <p className="text-center text-xs mb-6" style={{ color: "var(--text-muted)" }}>
                  Your wallet is created automatically. No setup required.
                </p>

                <div className="flex items-center gap-3 mb-6">
                  <div className="login-divider flex-1 h-px" />
                  <span className="text-xs text-text-muted">or continue with email</span>
                  <div className="login-divider flex-1 h-px" />
                </div>

                <form onSubmit={handleEmailAuth} className="space-y-3">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Email address"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    aria-label="Email address"
                    className="login-form-input w-full px-4 py-3 rounded-xl text-sm"
                  />

                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                      aria-label="Password"
                      className="login-form-input w-full px-4 py-3 pr-11 rounded-xl text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-secondary transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                    </button>
                  </div>

                  <AnimatePresence>
                    {mode === "signup" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                      >
                        <input
                          id="confirm-password"
                          name="confirm-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Confirm password"
                          value={confirmPassword}
                          onChange={e => setConfirmPassword(e.target.value)}
                          required
                          autoComplete="new-password"
                          aria-label="Confirm password"
                          className="login-form-input w-full px-4 py-3 rounded-xl text-sm mt-3"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {error && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="text-xs px-1 text-error"
                        role="alert"
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="w-full btn-gold py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 mt-1"
                    aria-busy={loading}
                  >
                    {loading
                      ? <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                      : <>{mode === "signin" ? "Sign in" : "Create account"} <ArrowRight size={15} aria-hidden="true" /></>
                    }
                  </motion.button>
                </form>

                <div className="mt-5 text-center">
                  <button
                    onClick={() => { setMode(m => m === "signin" ? "signup" : "signin"); setError(""); }}
                    className="text-sm text-text-muted hover:text-auron-gold transition-colors duration-150"
                  >
                    {mode === "signin"
                      ? "Don't have an account? Create one"
                      : "Already have an account? Sign in"}
                  </button>
                </div>

                <p className="text-center text-xs mt-6" style={{ color: "var(--text-muted)" }}>
                  By continuing, you agree to our Terms and Privacy Policy
                </p>
              </motion.div>
            )}

            {/* ── Step: PIN setup / confirm ─────────────── */}
            {(step === "pin" || step === "pin-confirm") && (
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4 }}
                className="text-center"
              >
                <div className="flex items-center justify-center mx-auto mb-6">
                  <AuronLogo size={56} />
                </div>
                <h2 className="font-display font-bold text-2xl sm:text-3xl mb-2 text-text-primary">
                  {step === "pin" ? "Set your PIN" : "Confirm your PIN"}
                </h2>
                <p className="text-sm mb-2 text-text-secondary">This PIN protects your transactions.</p>
                <p className="text-xs mb-10 text-text-muted">We never store it. Only you know it.</p>

                <div className="flex justify-center gap-4 mb-6">
                  {(step === "pin" ? pin : pinConfirm).map((digit, i) => (
                    <input
                      key={`pin-input-${step}-${i}`}
                      ref={step === "pin" ? pinRefs[i] : pinConfirmRefs[i]}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handlePinInput(
                        i, e.target.value,
                        step === "pin" ? pinRefs : pinConfirmRefs,
                        step === "pin" ? setPin : setPinConfirm
                      )}
                      onKeyDown={e => handlePinKeyDown(e, i, step === "pin" ? pinRefs : pinConfirmRefs)}
                      aria-label={`PIN digit ${i + 1}`}
                      className={`pin-input w-16 h-16 text-2xl font-bold text-center rounded-2xl ${digit ? "filled" : ""}`}
                    />
                  ))}
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="text-xs mb-4 text-error"
                      role="alert"
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                <motion.button
                  onClick={step === "pin" ? handlePinSubmit : handlePinConfirm}
                  disabled={loading || !(step === "pin" ? pin : pinConfirm).every(d => d !== "")}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="btn-gold px-10 py-3.5 rounded-xl font-bold text-sm flex items-center gap-2 mx-auto disabled:opacity-40"
                  aria-busy={loading}
                >
                  {loading
                    ? <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    : <>{step === "pin" ? "Next" : "Confirm PIN"} <ChevronRight size={16} aria-hidden="true" /></>
                  }
                </motion.button>

                <progress
                  value={step === "pin" ? 33 : 66}
                  max={100}
                  className="w-32 h-1 mx-auto mt-8 rounded-full"
                  aria-label="Sign-up progress"
                />
                <p className="text-xs text-text-muted mt-3">
                  Step {step === "pin" ? 1 : 2} of 3
                </p>
              </motion.div>
            )}

            {/* ── Step: Phone number entry ──────────────── */}
            {step === "phone" && (
              <motion.div
                key="phone"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4 }}
                className="text-center"
              >
                {/* Icon */}
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6"
                  style={{ background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)" }}>
                  <Phone size={24} style={{ color: "#C9A84C" }} />
                </div>

                <h2 className="font-display font-bold text-2xl sm:text-3xl mb-2 text-text-primary">
                  Add your phone
                </h2>
                <p className="text-sm mb-2 text-text-secondary">
                  So friends can send money to your number.
                </p>
                <p className="text-xs mb-8 text-text-muted">
                  We&apos;ll send a 6-digit OTP to verify it&apos;s yours.
                </p>

                {/* Phone input with +91 prefix */}
                <div className="flex gap-2 mb-4 text-left">
                  <div className="flex items-center gap-2 px-4 rounded-xl shrink-0 text-sm font-medium"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.5)",
                    }}>
                    🇮🇳 +91
                  </div>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    placeholder="10-digit mobile number"
                    value={phoneInput}
                    onChange={e => setPhoneInput(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    onKeyDown={e => e.key === "Enter" && handleSendOTP()}
                    aria-label="Mobile number"
                    autoComplete="tel-national"
                    className="login-form-input flex-1 px-4 py-3 rounded-xl text-sm"
                    autoFocus
                  />
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="text-xs mb-4 text-error text-left px-1"
                      role="alert"
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                <motion.button
                  onClick={handleSendOTP}
                  disabled={loading || phoneInput.length < 10}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full btn-gold py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                  aria-busy={loading}
                >
                  {loading
                    ? <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    : <>Send OTP <ArrowRight size={15} aria-hidden="true" /></>
                  }
                </motion.button>

                {/* Skip option */}
                <button
                  onClick={() => setStep("welcome")}
                  className="mt-4 text-xs text-text-muted hover:text-text-secondary transition-colors"
                >
                  Skip for now — I&apos;ll add it later
                </button>

                <progress value={66} max={100} className="w-32 h-1 mx-auto mt-8 rounded-full" aria-label="Sign-up progress" />
                <p className="text-xs text-text-muted mt-3">Step 3 of 3</p>
              </motion.div>
            )}

            {/* ── Step: OTP verification ────────────────── */}
            {step === "otp" && (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4 }}
                className="text-center"
              >
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6"
                  style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)" }}>
                  <ShieldCheck size={24} className="text-emerald-400" />
                </div>

                <h2 className="font-display font-bold text-2xl sm:text-3xl mb-2 text-text-primary">
                  Enter the code
                </h2>
                <p className="text-sm mb-1 text-text-secondary">
                  Sent to <span className="font-semibold text-white">{phoneE164}</span>
                </p>
                <p className="text-xs mb-8 text-text-muted">
                  Check your SMS — it expires in 10 minutes.
                </p>

                {/* 6-digit OTP boxes */}
                <div className="flex justify-center gap-2 mb-6">
                  {otpDigits.map((digit, i) => (
                    <input
                      key={`otp-${i}`}
                      id={`otp-${i}`}
                      name={`otp-${i}`}
                      ref={otpRefs[i]}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={e => handleOtpInput(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(e, i)}
                      autoComplete={i === 0 ? "one-time-code" : "off"}
                      aria-label={`OTP digit ${i + 1}`}
                      className={`pin-input w-12 h-14 text-xl font-bold text-center rounded-xl ${digit ? "filled" : ""}`}
                    />
                  ))}
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="text-xs mb-4 text-error"
                      role="alert"
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                {loading && (
                  <div className="flex justify-center mb-4">
                    <Loader2 size={20} className="animate-spin text-auron-gold" aria-hidden="true" />
                  </div>
                )}

                {/* Resend */}
                <div className="flex items-center justify-center gap-1 mt-2">
                  <span className="text-xs text-text-muted">Didn&apos;t receive it?</span>
                  <button
                    onClick={handleResendOTP}
                    disabled={otpResendCooldown > 0 || loading}
                    className="text-xs font-medium transition-colors disabled:opacity-40"
                    style={{ color: otpResendCooldown > 0 ? "var(--text-muted)" : "#C9A84C" }}
                  >
                    {otpResendCooldown > 0 ? `Resend in ${otpResendCooldown}s` : "Resend"}
                  </button>
                </div>

                {/* Back to change number */}
                <button
                  onClick={() => { setStep("phone"); setError(""); setOtpDigits(["", "", "", "", "", ""]); }}
                  className="mt-3 text-xs text-text-muted hover:text-text-secondary transition-colors"
                >
                  ← Change number
                </button>

                <progress value={90} max={100} className="w-32 h-1 mx-auto mt-8 rounded-full" aria-label="Sign-up progress" />
                <p className="text-xs text-text-muted mt-3">Step 3 of 3</p>
              </motion.div>
            )}

            {/* ── Step: Welcome ─────────────────────────── */}
            {step === "welcome" && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="text-center"
              >
                <div className="relative w-20 h-20 mx-auto mb-8">
                  <motion.div
                    className="absolute inset-0 rounded-full bg-auron-gold/15 border border-auron-gold/30"
                    animate={{ scale: [1, 1.15, 1], opacity: [1, 0.5, 1] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                  />
                  <div className="absolute inset-2 rounded-full btn-gold flex items-center justify-center">
                    <Check size={28} className="text-[#0A0A0F]" strokeWidth={3} aria-hidden="true" />
                  </div>
                </div>

                <h2 className="font-display font-black text-3xl sm:text-4xl mb-3 text-text-primary">
                  You&apos;re in.
                </h2>
                <p className="text-base mb-2 text-text-secondary">You are now</p>
                <div className="inline-block px-5 py-2 rounded-xl mb-8 bg-auron-gold/10 border border-auron-gold/30">
                  <span className="font-display font-bold text-xl gradient-text-gold">{username}</span>
                </div>
                <p className="text-sm mb-10 text-text-muted">
                  Your blockchain identity is ready. The rest is invisible.
                </p>

                <motion.button
                  onClick={() => router.push("/app")}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="btn-gold animate-btn-pulse inline-flex items-center gap-2 px-10 py-4 rounded-2xl font-bold text-base"
                  aria-label="Enter Auron"
                >
                  <AuronLogo size={18} />
                  Enter Auron
                  <ArrowRight size={16} aria-hidden="true" />
                </motion.button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ── Google SVG icon ───────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}
