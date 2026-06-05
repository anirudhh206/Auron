"use client";

import { useState, useRef, type RefObject, type ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@solana/wallet-adapter-react";
import { useStore } from "@/store/useStore";
import { shortAddr } from "@/lib/utils";
import AuronLogo from "@/components/AuronLogo";

type Step = "welcome" | "pin" | "ceiling" | "features" | "complete";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:      "#08080A",
  s1:      "#0F0F12",
  s2:      "#161619",
  s3:      "#1C1C20",
  border:  "#26262A",
  borderB: "#3A3A3F",
  text:    "#F5F5F0",
  muted:   "#9A9AA8",
  dim:     "#606068",
  lime:    "#C8F135",
  gold:    "#F5A623",
  usdc:    "#2775CA",
  error:   "#EF4444",
};

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@300;400;500;600&display=swap');

  .ob-root {
    min-height: 100dvh;
    background: ${C.bg};
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px 20px;
    font-family: 'Geist', sans-serif;
    -webkit-font-smoothing: antialiased;
    position: relative;
    overflow: hidden;
  }

  /* Lime top glow */
  .ob-root::after {
    content: '';
    position: fixed;
    top: 0; left: 0; right: 0;
    height: 300px;
    background: radial-gradient(ellipse 70% 55% at 50% 0%, rgba(200,241,53,0.06) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
  }

  /* Dot grid */
  .ob-root::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image: radial-gradient(circle, ${C.border} 1px, transparent 1px);
    background-size: 28px 28px;
    opacity: 0.2;
    pointer-events: none;
    z-index: 0;
  }

  .ob-card {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 400px;
    background: ${C.s1};
    border: 1px solid ${C.border};
    border-radius: 20px;
    padding: 32px 28px;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  /* Input */
  .ob-input {
    width: 100%;
    padding: 14px 16px;
    background: ${C.s2};
    border: 1px solid ${C.border};
    border-radius: 12px;
    font-family: 'Geist Mono', monospace;
    font-size: 22px;
    font-weight: 500;
    letter-spacing: 0.3em;
    text-align: center;
    color: ${C.text};
    outline: none;
    transition: border-color 0.2s;
    box-sizing: border-box;
  }
  .ob-input:focus { border-color: ${C.borderB}; }
  .ob-input:focus-visible { box-shadow: 0 0 0 2px rgba(200,241,53,0.12); }
  .ob-input:disabled { opacity: 0.5; }

  .ob-input-number {
    font-size: 18px;
    letter-spacing: 0;
    text-align: left;
  }

  /* Label */
  .ob-label {
    font-family: 'Geist Mono', monospace;
    font-size: 10px;
    color: ${C.dim};
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 8px;
    display: block;
  }

  /* Primary button */
  .ob-btn {
    width: 100%;
    padding: 15px;
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
    transition: background 0.15s, transform 0.1s;
  }
  .ob-btn:hover:not(:disabled) { background: #A3C42A; }
  .ob-btn:active:not(:disabled) { transform: scale(0.99); }
  .ob-btn:disabled {
    background: ${C.s2};
    border: 1px solid ${C.border};
    color: ${C.dim};
    cursor: not-allowed;
  }

  /* Feature card */
  .ob-feature {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    padding: 14px;
    background: ${C.s2};
    border: 1px solid ${C.border};
    border-radius: 12px;
    transition: border-color 0.15s;
  }
  .ob-feature:hover { border-color: ${C.borderB}; }

  /* Error box */
  .ob-error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    background: rgba(239,68,68,0.06);
    border: 1px solid rgba(239,68,68,0.2);
    border-radius: 10px;
    font-family: 'Geist Mono', monospace;
    font-size: 11px;
    color: ${C.error};
  }

  /* Info box */
  .ob-info {
    padding: 12px 14px;
    background: rgba(200,241,53,0.04);
    border: 1px solid rgba(200,241,53,0.12);
    border-radius: 10px;
    font-family: 'Geist Mono', monospace;
    font-size: 11px;
    color: ${C.muted};
    line-height: 1.5;
  }

  /* Stepper dots */
  .ob-dots {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
  .ob-dot {
    height: 3px;
    border-radius: 999px;
    background: ${C.border};
    transition: width 0.3s, background 0.3s;
  }
  .ob-dot-active {
    background: ${C.lime};
    width: 18px;
  }
  .ob-dot-inactive { width: 6px; }
`;

export default function OnboardingFlow() {
  const { publicKey } = useWallet();
  const address = publicKey?.toString() ?? null;
  const { setPrefs } = useStore();

  const [step, setStep]       = useState<Step>("welcome");
  const [pin, setPin]         = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [ceiling, setCeiling] = useState("500");
  const [error, setError]     = useState("");
  const [isSubmitting, setSubmitting] = useState(false);

  const pinRef     = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);

  const displayName = address ? shortAddr(address) : "Wallet connected";

  const STEP_ORDER: Step[] = ["welcome", "pin", "ceiling", "features", "complete"];
  const stepIdx = STEP_ORDER.indexOf(step);

  async function validateAndHashPin(pinValue: string): Promise<string | null> {
    if (!/^\d{4}$/.test(pinValue)) {
      setError("PIN must be exactly 4 digits");
      return null;
    }
    try {
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
    } catch {
      setError("Network error. Please try again.");
      return null;
    }
  }

  async function handlePinStep() {
    setError("");
    if (!pin || !pinConfirm) { setError("Both fields are required"); return; }
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
      setPrefs({ pin: hashedPin });
      setPin(""); setPinConfirm("");
      setStep("ceiling");
    } finally { setSubmitting(false); }
  }

  function handleCeilingStep() {
    setError("");
    const num = Number.parseInt(ceiling, 10);
    if (Number.isNaN(num) || num < 100 || num > 100000) {
      setError("Ceiling must be between ₹100 and ₹100,000");
      return;
    }
    setPrefs({ spendCeiling: num, dailyCap: num * 10 });
    setStep("features");
  }

  function handleComplete() {
    setPrefs({ hasOnboarded: true });
    setStep("complete");
  }

  const fadeUp = {
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    exit:    { opacity: 0, y: -12 },
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  };

  return (
    <>
      <style>{STYLES}</style>
      <div className="ob-root">
        <motion.div
          className="ob-card"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Step dots */}
          {step !== "complete" && (
            <div className="ob-dots">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`ob-dot ${i === stepIdx - 0 || (i === 0 && stepIdx === 0) ? "ob-dot-active" : "ob-dot-inactive"}`}
                  style={{
                    background: i < stepIdx ? C.lime : i === stepIdx ? C.lime : C.border,
                    width: i === stepIdx ? 18 : 6,
                  }}
                />
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div key={step} {...fadeUp}>

              {step === "welcome" && (
                <WelcomeStep displayName={displayName} onNext={() => setStep("pin")} />
              )}
              {step === "pin" && (
                <PinStep
                  pin={pin} pinConfirm={pinConfirm}
                  error={error} isSubmitting={isSubmitting}
                  onPinChange={setPin} onConfirmChange={setPinConfirm}
                  onSubmit={handlePinStep}
                  pinRef={pinRef} confirmRef={confirmRef}
                />
              )}
              {step === "ceiling" && (
                <CeilingStep
                  ceiling={ceiling} error={error} isSubmitting={isSubmitting}
                  onCeilingChange={setCeiling} onSubmit={handleCeilingStep}
                />
              )}
              {step === "features" && (
                <FeaturesStep onNext={handleComplete} isSubmitting={isSubmitting} />
              )}
              {step === "complete" && <CompleteStep />}

            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </>
  );
}

// ── Step 1: Welcome ────────────────────────────────────────────────────────────
function WelcomeStep({ displayName, onNext }: { displayName: string; onNext: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Logo + title */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <AuronLogo size={56} />
        <div style={{ textAlign: "center" }}>
          <p style={{ fontFamily: "'Instrument Serif',serif", fontSize: 28, color: C.text, margin: 0 }}>
            Welcome to Auron
          </p>
          <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.dim, margin: "6px 0 0", letterSpacing: "0.06em" }}>
            THE BLOCKCHAIN THAT DISAPPEARS
          </p>
        </div>
      </div>

      {/* Wallet chip */}
      <div style={{
        padding: "12px 16px", borderRadius: 10,
        background: C.s2, border: `1px solid ${C.border}`,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.lime, flexShrink: 0 }} />
        <div>
          <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 9, color: C.dim, letterSpacing: "0.1em", marginBottom: 2 }}>
            CONNECTED AS
          </p>
          <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 13, color: C.text, margin: 0 }}>
            {displayName}
          </p>
        </div>
      </div>

      {/* Steps preview */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[
          { label: "Set a 4-digit PIN",      accent: C.lime },
          { label: "Set your instant limit", accent: C.gold },
          { label: "See how Auron protects you", accent: C.usdc },
        ].map(({ label, accent }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: accent, flexShrink: 0 }} />
            <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>{label}</p>
          </div>
        ))}
      </div>

      <button className="ob-btn" onClick={onNext}>
        Get Started
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </button>

      <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, textAlign: "center", letterSpacing: "0.04em" }}>
        Takes less than 2 minutes.
      </p>
    </div>
  );
}

// ── Step 2: PIN Setup ──────────────────────────────────────────────────────────
function PinStep({
  pin, pinConfirm, error, isSubmitting,
  onPinChange, onConfirmChange, onSubmit, pinRef, confirmRef,
}: {
  pin: string; pinConfirm: string; error: string; isSubmitting: boolean;
  onPinChange: (v: string) => void; onConfirmChange: (v: string) => void;
  onSubmit: () => void;
  pinRef: RefObject<HTMLInputElement | null>; confirmRef: RefObject<HTMLInputElement | null>;
}) {
  const handlePinInput = (e: ChangeEvent<HTMLInputElement>) => {
    onPinChange(e.target.value.replaceAll(/\D/g, "").slice(0, 4));
  };
  const handleConfirmInput = (e: ChangeEvent<HTMLInputElement>) => {
    onConfirmChange(e.target.value.replaceAll(/\D/g, "").slice(0, 4));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Header */}
      <div>
        <p style={{ fontFamily: "'Instrument Serif',serif", fontSize: 24, color: C.text, margin: 0 }}>
          Create a PIN
        </p>
        <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.dim, margin: "6px 0 0", lineHeight: 1.5 }}>
          4 digits. Protects your account from unauthorized access.
        </p>
      </div>

      {/* Fields */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label className="ob-label" htmlFor="pin">PIN</label>
          <input
            id="pin" ref={pinRef}
            className="ob-input"
            type="password" inputMode="numeric" maxLength={4}
            value={pin} onChange={handlePinInput}
            placeholder="••••" disabled={isSubmitting}
          />
        </div>
        <div>
          <label className="ob-label" htmlFor="pin-confirm">Confirm PIN</label>
          <input
            id="pin-confirm" ref={confirmRef}
            className="ob-input"
            type="password" inputMode="numeric" maxLength={4}
            value={pinConfirm} onChange={handleConfirmInput}
            placeholder="••••" disabled={isSubmitting}
          />
        </div>

        {error && (
          <div className="ob-error">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}
      </div>

      <div className="ob-info">
        Never share your PIN. Auron staff will never ask for it.
      </div>

      <button
        className="ob-btn"
        onClick={onSubmit}
        disabled={isSubmitting || pin.length !== 4 || pinConfirm.length !== 4}
      >
        {isSubmitting ? "Securing…" : "Continue"}
      </button>
    </div>
  );
}

// ── Step 3: Spend Ceiling ──────────────────────────────────────────────────────
function CeilingStep({
  ceiling, error, isSubmitting, onCeilingChange, onSubmit,
}: {
  ceiling: string; error: string; isSubmitting: boolean;
  onCeilingChange: (v: string) => void; onSubmit: () => void;
}) {
  const num = Number.parseInt(ceiling, 10) || 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <p style={{ fontFamily: "'Instrument Serif',serif", fontSize: 24, color: C.text, margin: 0 }}>
          Set Your Limit
        </p>
        <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.dim, margin: "6px 0 0", lineHeight: 1.5 }}>
          Max amount you can send instantly without extra confirmation.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label className="ob-label" htmlFor="spend-ceiling">Instant Send Limit (₹)</label>
          <input
            id="spend-ceiling"
            className="ob-input ob-input-number"
            type="number" placeholder="500" min="100" max="100000"
            value={ceiling}
            onChange={(e) => onCeilingChange(e.target.value)}
            disabled={isSubmitting}
          />
          {num > 0 && (
            <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, margin: "6px 0 0" }}>
              Daily cap: ₹{(num * 10).toLocaleString("en-IN")}
            </p>
          )}
        </div>

        {error && (
          <div className="ob-error">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        <div className="ob-info">
          Amounts above this limit will require a hold-to-confirm gesture to prevent accidental transfers.
        </div>
      </div>

      <button className="ob-btn" onClick={onSubmit} disabled={isSubmitting || !ceiling}>
        {isSubmitting ? "Saving…" : "Continue"}
      </button>
    </div>
  );
}

// ── Step 4: Features ───────────────────────────────────────────────────────────
function FeaturesStep({ onNext, isSubmitting }: { onNext: () => void; isSubmitting: boolean }) {
  const features = [
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.lime} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
      ),
      title: "Send Money",
      desc: "Type 'send ₹500 to Priya' — on-chain, instantly, with settlement certainty.",
      accent: C.lime,
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      ),
      title: "Lock Savings + Earn Yield",
      desc: "Lock for 3 months. Earns 8–15% interest automatically. No effort.",
      accent: C.gold,
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.usdc} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      ),
      title: "Record Agreements",
      desc: "Record a deal on-chain. Both parties sign. Both get immutable proof.",
      accent: C.usdc,
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <p style={{ fontFamily: "'Instrument Serif',serif", fontSize: 24, color: C.text, margin: 0 }}>
          What You Can Do
        </p>
        <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.dim, margin: "6px 0 0" }}>
          Three powerful actions, all via plain English.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {features.map((f) => (
          <div key={f.title} className="ob-feature">
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: `${f.accent}14`,
              border: `1px solid ${f.accent}28`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {f.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: C.text, margin: 0 }}>{f.title}</p>
              <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, margin: "3px 0 0", lineHeight: 1.5 }}>
                {f.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="ob-info" style={{ textAlign: "center" }}>
        No blockchain knowledge needed. The blockchain stays invisible.
      </div>

      <button className="ob-btn" onClick={onNext} disabled={isSubmitting}>
        {isSubmitting ? "Finalizing…" : "Finish Setup"}
      </button>
    </div>
  );
}

// ── Step 5: Complete ───────────────────────────────────────────────────────────
function CompleteStep() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, textAlign: "center" }}>
      {/* Checkmark ring */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.1 }}
        style={{
          width: 72, height: 72, borderRadius: "50%",
          background: "rgba(200,241,53,0.08)",
          border: `1px solid rgba(200,241,53,0.3)`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={C.lime} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </motion.div>

      <div>
        <p style={{ fontFamily: "'Instrument Serif',serif", fontSize: 28, color: C.text, margin: 0 }}>
          You're All Set
        </p>
        <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 11, color: C.dim, margin: "8px 0 0", letterSpacing: "0.04em" }}>
          Your Auron account is ready.
        </p>
      </div>

      <div style={{
        width: "100%", padding: "16px 18px", borderRadius: 12,
        background: C.s2, border: `1px solid ${C.border}`,
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        {["Send money on-chain", "Record agreements", "Lock savings on-chain"].map((item) => (
          <div key={item} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.lime} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>{item}</p>
          </div>
        ))}
      </div>

      <button
        className="ob-btn"
        onClick={() => globalThis.location.reload()}
        style={{ marginTop: 4 }}
      >
        Start Using Auron
      </button>

      <p style={{ fontFamily: "'Geist Mono',monospace", fontSize: 10, color: C.dim, letterSpacing: "0.04em" }}>
        Auron is on devnet. Do not use real funds.
      </p>
    </div>
  );
}
