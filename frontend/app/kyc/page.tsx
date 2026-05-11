"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, FileText, Clock, CheckCircle, XCircle, Loader2 } from "lucide-react";

type Step = "intro" | "submitting" | "pending" | "rejected";

const STATUS_MESSAGES: Record<string, { title: string; body: string }> = {
  pending: {
    title: "Verification in progress",
    body: "Your documents are being reviewed. This usually takes 2–10 minutes. We'll notify you when it's done.",
  },
  rejected: {
    title: "Verification unsuccessful",
    body: "We couldn't verify your identity with the documents provided. Please try again with a valid Aadhaar card, PAN card, or passport.",
  },
  manual_review: {
    title: "Manual review required",
    body: "Your verification has been escalated for manual review. This can take up to 24 hours. You'll receive an email when it's complete.",
  },
};

export default function KycPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentStatus = searchParams.get("status") ?? "unverified";

  const [step, setStep] = useState<Step>(
    currentStatus === "pending" || currentStatus === "manual_review" ? "pending" :
    currentStatus === "rejected" ? "rejected" : "intro"
  );
  const [error, setError] = useState<string | null>(null);

  async function startVerification() {
    setStep("submitting");
    setError(null);

    try {
      const res = await fetch("/api/kyc/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "sumsub" }),
      });

      if (!res.ok) throw new Error("Failed to start verification");

      const { sdkToken, redirectUrl } = await res.json() as { sdkToken?: string; redirectUrl?: string };

      if (redirectUrl) {
        // DigiLocker flow — redirect to government portal
        window.location.href = redirectUrl;
        return;
      }

      if (sdkToken && typeof window !== "undefined") {
        // Sumsub SDK flow — launch in-app iframe widget
        // In production: dynamically load Sumsub WebSDK and launch it
        // For demo: transition to pending state
        setStep("pending");
        return;
      }

      setStep("pending");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStep("intro");
    }
  }

  return (
    <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4">
      <motion.div
        className="w-full max-w-md bg-white/5 border border-white/10 rounded-2xl p-8"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <AnimatePresence mode="wait">

          {/* ── Intro ── */}
          {step === "intro" && (
            <motion.div key="intro" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h1 className="text-white font-semibold text-lg">Verify your identity</h1>
                  <p className="text-white/50 text-sm">Required for UPI payments in India</p>
                </div>
              </div>

              <p className="text-white/70 text-sm mb-6 leading-relaxed">
                Indian regulations require identity verification before you can make payments to merchants.
                This is a one-time process and takes under 2 minutes.
              </p>

              <div className="space-y-3 mb-8">
                {[
                  { icon: FileText, text: "Aadhaar card, PAN card, or passport" },
                  { icon: Clock, text: "Verified in 2–10 minutes" },
                  { icon: ShieldCheck, text: "Data encrypted — never shared with merchants" },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-3 text-white/60 text-sm">
                    <Icon className="w-4 h-4 text-white/40 shrink-0" />
                    <span>{text}</span>
                  </div>
                ))}
              </div>

              {error && (
                <p className="text-red-400 text-sm mb-4 p-3 bg-red-500/10 rounded-lg">{error}</p>
              )}

              <button
                onClick={startVerification}
                className="w-full py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors"
              >
                Start verification
              </button>

              <button
                onClick={() => router.push("/app")}
                className="w-full mt-3 py-2 text-white/40 text-sm hover:text-white/60 transition-colors"
              >
                Skip for now (wallet transfers only)
              </button>
            </motion.div>
          )}

          {/* ── Submitting ── */}
          {step === "submitting" && (
            <motion.div key="submitting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center py-8 gap-4">
              <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
              <p className="text-white/70 text-sm">Starting secure verification…</p>
            </motion.div>
          )}

          {/* ── Pending ── */}
          {step === "pending" && (
            <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-yellow-400" />
                </div>
                <h1 className="text-white font-semibold">{STATUS_MESSAGES.pending.title}</h1>
              </div>
              <p className="text-white/60 text-sm leading-relaxed mb-8">
                {STATUS_MESSAGES.pending.body}
              </p>
              <button
                onClick={() => router.push("/app")}
                className="w-full py-3 rounded-xl bg-white/10 text-white text-sm hover:bg-white/15 transition-colors"
              >
                Continue to Auron (limited access)
              </button>
            </motion.div>
          )}

          {/* ── Rejected ── */}
          {step === "rejected" && (
            <motion.div key="rejected" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-red-400" />
                </div>
                <h1 className="text-white font-semibold">{STATUS_MESSAGES.rejected.title}</h1>
              </div>
              <p className="text-white/60 text-sm leading-relaxed mb-8">
                {STATUS_MESSAGES.rejected.body}
              </p>
              <button
                onClick={() => setStep("intro")}
                className="w-full py-3 rounded-xl bg-white text-black font-semibold text-sm hover:bg-white/90 transition-colors"
              >
                Try again
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  );
}
