"use client";

import { useEffect, useState } from "react";
import { useInterwovenKit } from "@initia/interwovenkit-react";
import { useStore } from "@/store/useStore";
import WalletWidget from "@/components/WalletWidget";
import ChatInterface from "@/components/ChatInterface";
import TransactionHistory from "@/components/TransactionHistory";
import OnboardingFlow from "@/components/OnboardingFlow";
import { Zap, History } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Home() {
  const { address, isConnected } = useInterwovenKit();
  const { setAddress, prefs }    = useStore();
  const [showHistory, setShowHistory] = useState(false);

  // Sync wallet address into store whenever it changes
  useEffect(() => {
    setAddress(address ?? null);
  }, [address, setAddress]);

  // Show onboarding for first-time users
  if (isConnected && !prefs.hasOnboarded) {
    return <OnboardingFlow />;
  }

  return (
    <div className="flex flex-col h-screen bg-[#030712] overflow-hidden">

      {/* ── Header ───────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/6 shrink-0">

        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center">
            <Zap size={16} className="text-white" fill="white" />
          </div>
          <div className="leading-none">
            <span className="text-white font-bold text-base tracking-tight">Auron</span>
            <span className="hidden sm:block text-gray-500 text-[10px] mt-0.5">
              The blockchain that disappears.
            </span>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* History button — only when connected */}
          {isConnected && (
            <button
              onClick={() => setShowHistory(true)}
              className={cn(
                "p-2 rounded-xl transition-colors",
                "text-gray-400 hover:text-white hover:bg-white/6",
                "border border-transparent hover:border-white/10"
              )}
              title="Transaction history"
            >
              <History size={18} />
            </button>
          )}

          <WalletWidget />
        </div>
      </header>

      {/* ── Main chat area ─────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden max-w-2xl w-full mx-auto">
        <ChatInterface />
      </main>

      {/* ── Transaction history drawer ─────────────────────────── */}
      {showHistory && (
        <TransactionHistory onClose={() => setShowHistory(false)} />
      )}
    </div>
  );
}
