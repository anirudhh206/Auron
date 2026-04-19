"use client";

import { useState, useRef, type RefObject, type ChangeEvent } from "react";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { useStore } from "@/store/useStore";
import { cn, shortAddr } from "@/lib/utils";
import { ChevronRight, Lock, Zap, FileText, DollarSign, Check, AlertCircle } from "lucide-react";

type Step = "welcome" | "pin" | "ceiling" | "features" | "complete";

export default function OnboardingFlow() {
  const { address, username } = useInterwovenKit();
  const { setPrefs } = useStore();

  const [step, setStep] = useState<Step>("welcome");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [ceiling, setCeiling] = useState("500");
  const [error, setError] = useState("");
  const [isSubmitting, setSubmitting] = useState(false);

  const pinRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const displayName = username || shortAddr(address);

  // ── Step 1: PIN validation & hashing (SERVER-SIDE) ─────────
  async function validateAndHashPin(pinValue: string): Promise<string | null> {
    // Validate PIN format
    if (!/^\d{4}$/.test(pinValue)) {
      setError("PIN must be exactly 4 digits");
      return null;
    }

    try {
      // Hash PIN on server with argon2 (never client-side)
      const res = await fetch("/api/hash-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinValue }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to secure PIN");
        return null;
      }

      const data = await res.json();
      return data.hash;

    } catch (err) {
      setError("Network error while securing PIN. Please try again.");
      console.error("[PIN Hash Error]", err instanceof Error ? err.message : "Unknown");
      return null;
    }
  }

  async function handlePinStep() {
    setError("");
    if (!pin || !pinConfirm) {
      setError("Both fields are required");
      return;
    }

    if (pin !== pinConfirm) {
      setError("PINs do not match");
      setPinConfirm("");
      confirmRef.current?.focus();
      return;
    }

    const hashedPin = await validateAndHashPin(pin);
    if (!hashedPin) return;

    setSubmitting(true);
    try {
      // Store hashed PIN (never plain text)
      setPrefs({ pin: hashedPin });
      setPin("");
      setPinConfirm("");
      setStep("ceiling");
    } finally {
      setSubmitting(false);
    }
  }

  function handleCeilingStep() {
    setError("");
    const num = Number.parseInt(ceiling, 10);

    if (Number.isNaN(num) || num < 100 || num > 100000) {
      setError("Ceiling must be between ₹100 and ₹100,000");
      return;
    }

    setPrefs({
      spendCeiling: num,
      dailyCap: num * 10,
    });
    setStep("features");
  }

  function handleComplete() {
    setPrefs({ hasOnboarded: true });
    setStep("complete");
  }

  // ── Render each step ───────────────────────────────────────
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#030712] px-4">
      <div className="w-full max-w-md animate-fade-in">

        {step === "welcome" && (
          <WelcomeStep displayName={displayName} onNext={() => setStep("pin")} />
        )}

        {step === "pin" && (
          <PinStep
            pin={pin}
            pinConfirm={pinConfirm}
            error={error}
            isSubmitting={isSubmitting}
            onPinChange={setPin}
            onConfirmChange={setPinConfirm}
            onSubmit={handlePinStep}
            pinRef={pinRef}
            confirmRef={confirmRef}
          />
        )}

        {step === "ceiling" && (
          <CeilingStep
            ceiling={ceiling}
            error={error}
            isSubmitting={isSubmitting}
            onCeilingChange={setCeiling}
            onSubmit={handleCeilingStep}
          />
        )}

        {step === "features" && (
          <FeaturesStep onNext={handleComplete} isSubmitting={isSubmitting} />
        )}

        {step === "complete" && <CompleteStep />}
      </div>
    </div>
  );
}

// ── Step 1: Welcome ────────────────────────────────────────────
function WelcomeStep({
  displayName,
  onNext,
}: {
  readonly displayName: string;
  readonly onNext: () => void;
}) {
  return (
    <div className="space-y-6 text-center">
      <div>
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-violet-700 flex items-center justify-center mx-auto mb-4">
          <Zap size={32} className="text-white" fill="white" />
        </div>
        <h1 className="text-3xl font-bold text-white">Welcome to Auron</h1>
        <p className="text-gray-400 mt-2">The blockchain that disappears.</p>
      </div>

      <div className="bg-[#161b27] border border-white/6 rounded-2xl p-4">
        <p className="text-gray-400 text-sm">Connected as</p>
        <p className="text-white font-semibold text-lg mt-1">{displayName}</p>
      </div>

      <div className="space-y-3 text-left">
        <p className="text-gray-400 text-sm">
          Let's set up your account in 2 minutes. We'll configure:
        </p>
        <ul className="space-y-2">
          <li className="flex items-center gap-2 text-gray-300 text-sm">
            <Lock size={14} className="text-violet-400 shrink-0" />
            A 4-digit PIN for security
          </li>
          <li className="flex items-center gap-2 text-gray-300 text-sm">
            <DollarSign size={14} className="text-emerald-400 shrink-0" />
            Your instant-send limit
          </li>
          <li className="flex items-center gap-2 text-gray-300 text-sm">
            <Zap size={14} className="text-amber-400 shrink-0" />
            How Auron protects you
          </li>
        </ul>
      </div>

      <button
        type="button"
        onClick={onNext}
        className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-all duration-150 active:scale-95 flex items-center justify-center gap-2"
      >
        Let's Go
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

// ── Step 2: PIN Setup ──────────────────────────────────────────
function PinStep({
  pin,
  pinConfirm,
  error,
  isSubmitting,
  onPinChange,
  onConfirmChange,
  onSubmit,
  pinRef,
  confirmRef,
}: {
  readonly pin: string;
  readonly pinConfirm: string;
  readonly error: string;
  readonly isSubmitting: boolean;
  readonly onPinChange: (v: string) => void;
  readonly onConfirmChange: (v: string) => void;
  readonly onSubmit: () => void;
  readonly pinRef: RefObject<HTMLInputElement>;
  readonly confirmRef: RefObject<HTMLInputElement>;
}) {
  const handlePinInput = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replaceAll(/\D/g, "").slice(0, 4);
    onPinChange(val);
  };

  const handleConfirmInput = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replaceAll(/\D/g, "").slice(0, 4);
    onConfirmChange(val);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Create a PIN</h2>
        <p className="text-gray-400 text-sm mt-1">
          4 digits. This protects your Auron account from unauthorized access.
        </p>
      </div>

      <div className="space-y-4">
        {/* PIN Input */}
        <div>
          <label htmlFor="pin" className="text-gray-400 text-xs uppercase tracking-wider font-medium block mb-2">
            PIN
          </label>
          <input
            id="pin"
            ref={pinRef}
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pin}
            onChange={handlePinInput}
            placeholder="••••"
            disabled={isSubmitting}
            className={cn(
              "w-full px-4 py-3 rounded-xl text-center text-2xl tracking-widest font-semibold",
              "bg-[#1c2333] border border-white/10 text-white placeholder-gray-600",
              "focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/20",
              "disabled:opacity-50 transition-all duration-150"
            )}
          />
        </div>

        {/* Confirm PIN */}
        <div>
          <label htmlFor="pin-confirm" className="text-gray-400 text-xs uppercase tracking-wider font-medium block mb-2">
            Confirm PIN
          </label>
          <input
            id="pin-confirm"
            ref={confirmRef}
            type="password"
            inputMode="numeric"
            maxLength={4}
            value={pinConfirm}
            onChange={handleConfirmInput}
            placeholder="••••"
            disabled={isSubmitting}
            className={cn(
              "w-full px-4 py-3 rounded-xl text-center text-2xl tracking-widest font-semibold",
              "bg-[#1c2333] border border-white/10 text-white placeholder-gray-600",
              "focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/20",
              "disabled:opacity-50 transition-all duration-150"
            )}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/40 border border-red-700/40">
            <AlertCircle size={14} className="text-red-400 shrink-0" />
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}
      </div>

      <div className="text-center text-gray-500 text-xs">
        <p>Never share your PIN with anyone. Auron staff will never ask for it.</p>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={isSubmitting || pin.length !== 4 || pinConfirm.length !== 4}
        className={cn(
          "w-full py-3 rounded-xl font-semibold transition-all duration-150 active:scale-95",
          pin.length === 4 && pinConfirm.length === 4 && !isSubmitting
            ? "bg-violet-600 hover:bg-violet-500 text-white"
            : "bg-gray-700 text-gray-400 cursor-not-allowed"
        )}
      >
        {isSubmitting ? "Securing..." : "Continue"}
      </button>
    </div>
  );
}

// ── Step 3: Spend Ceiling ──────────────────────────────────────
function CeilingStep({
  ceiling,
  error,
  isSubmitting,
  onCeilingChange,
  onSubmit,
}: {
  readonly ceiling: string;
  readonly error: string;
  readonly isSubmitting: boolean;
  readonly onCeilingChange: (v: string) => void;
  readonly onSubmit: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Set Your Limit</h2>
        <p className="text-gray-400 text-sm mt-1">
          How much can you send in one go without extra confirmation?
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="spend-ceiling" className="text-gray-400 text-xs uppercase tracking-wider font-medium block mb-2">
            Instant Send Limit (₹)
          </label>
          <input
            id="spend-ceiling"
            type="number"
            placeholder="500"
            min="100"
            max="100000"
            value={ceiling}
            onChange={(e) => onCeilingChange(e.target.value)}
            disabled={isSubmitting}
            className={cn(
              "w-full px-4 py-3 rounded-xl text-lg font-semibold",
              "bg-[#1c2333] border border-white/10 text-white",
              "focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500/20",
              "disabled:opacity-50 transition-all duration-150"
            )}
          />
          <p className="text-gray-500 text-xs mt-2">
            Default daily limit: ₹{(Number.parseInt(ceiling, 10) * 10 || 5000).toLocaleString("en-IN")}
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/40 border border-red-700/40">
            <AlertCircle size={14} className="text-red-400 shrink-0" />
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        <div className="bg-blue-950/30 border border-blue-700/30 rounded-xl p-3">
          <p className="text-blue-300 text-xs">
            <strong>What's this?</strong> Amounts above this ceiling require extra confirmation (hold button) to prevent accidental transfers.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={isSubmitting || !ceiling}
        className={cn(
          "w-full py-3 rounded-xl font-semibold transition-all duration-150 active:scale-95",
          ceiling ? "bg-violet-600 hover:bg-violet-500 text-white" : "bg-gray-700 text-gray-400 cursor-not-allowed"
        )}
      >
        {isSubmitting ? "Saving..." : "Continue"}
      </button>
    </div>
  );
}

// ── Step 4: Features Explainer ─────────────────────────────────
function FeaturesStep({
  onNext,
  isSubmitting,
}: {
  readonly onNext: () => void;
  readonly isSubmitting: boolean;
}) {
  const features = [
    {
      icon: Zap,
      title: "Send Money",
      desc: "Type 'send Rs500 to Priya' — it happens on-chain, instantly, with settlement certainty.",
      color: "text-violet-400",
      bg: "bg-violet-500/10",
    },
    {
      icon: FileText,
      title: "Save Agreements",
      desc: "Record a deal or IOU with another person. Both sign, both get proof that lives forever on-chain.",
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      icon: Lock,
      title: "Lock Savings + Earn Yield",
      desc: "Lock money for 3 months. It automatically earns 8-15% interest. No effort, no risk.",
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">What You Can Do</h2>
        <p className="text-gray-400 text-sm mt-1">
          Three powerful actions, all via plain English.
        </p>
      </div>

      <div className="space-y-3">
        {features.map((f) => {
          const Icon = f.icon;
          return (
            <div
              key={f.title}
              className={cn(
                "p-4 rounded-xl border border-white/6",
                "bg-[#161b27] hover:border-white/10 transition-colors"
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5", f.bg)}>
                  <Icon size={16} className={f.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold text-sm">{f.title}</h3>
                  <p className="text-gray-400 text-xs mt-1">{f.desc}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-emerald-950/30 border border-emerald-700/30 rounded-xl p-4 text-center">
        <p className="text-emerald-300 text-xs">
          <strong>No blockchain knowledge needed.</strong> Auron handles all the complexity. The blockchain stays invisible.
        </p>
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={isSubmitting}
        className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-all duration-150 active:scale-95 disabled:opacity-50"
      >
        {isSubmitting ? "Finalizing..." : "Finish Setup"}
      </button>
    </div>
  );
}

// ── Step 5: Complete ───────────────────────────────────────────
function CompleteStep() {
  return (
    <div className="space-y-6 text-center">
      <div>
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center mx-auto mb-4">
          <Check size={32} className="text-white" fill="white" />
        </div>
        <h1 className="text-3xl font-bold text-white">You're All Set!</h1>
        <p className="text-gray-400 mt-2">Your Auron account is ready to go.</p>
      </div>

      <div className="bg-[#161b27] border border-emerald-700/30 rounded-2xl p-6 space-y-3">
        <p className="text-gray-400 text-sm">
          You can now:
        </p>
        <ul className="space-y-2 text-left">
          <li className="flex items-center gap-2 text-emerald-300 text-sm">
            <Check size={14} className="shrink-0" />
            Send money on-chain
          </li>
          <li className="flex items-center gap-2 text-emerald-300 text-sm">
            <Check size={14} className="shrink-0" />
            Record agreements
          </li>
          <li className="flex items-center gap-2 text-emerald-300 text-sm">
            <Check size={14} className="shrink-0" />
            Lock savings & earn yield
          </li>
        </ul>
      </div>

      <button
        type="button"
        onClick={() => globalThis.location.reload()}
        className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-all duration-150 active:scale-95"
      >
        Start Using Auron
      </button>

      <p className="text-gray-600 text-xs">
        Auron is in testnet. Do not use real funds.
      </p>
    </div>
  );
}

// PIN hashing is now done server-side via /api/hash-pin endpoint
// Never hash PINs client-side — that's insecure
