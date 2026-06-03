"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { AlertTriangle } from "lucide-react";
import { NETWORK } from "@/lib/solana";

/**
 * Shows a warning banner if Phantom is connected to the wrong Solana network.
 * E.g. user is on devnet but app is on mainnet-beta.
 */
export default function NetworkMismatchBanner() {
  const { wallet, connected } = useWallet();
  const [mismatch, setMismatch] = useState(false);
  const [walletNetwork, setWalletNetwork] = useState<string>("");

  useEffect(() => {
    if (!connected || !wallet) {
      setMismatch(false);
      return;
    }

    try {
      // Phantom exposes window.solana.networkVersion or we read from the adapter
      const phantom = (window as unknown as { solana?: { networkVersion?: string; network?: string } }).solana;
      const detected = phantom?.networkVersion ?? phantom?.network ?? "";

      if (!detected) return; // Can't detect — don't show false warning

      // Normalize: Phantom returns "mainnet-beta" or "devnet"
      const normalized = detected.includes("mainnet") ? "mainnet-beta" : "devnet";
      setWalletNetwork(normalized);
      setMismatch(normalized !== NETWORK);
    } catch {
      // Silent — don't block payments on detection failure
    }
  }, [connected, wallet]);

  if (!mismatch) return null;

  const expected = NETWORK;
  const got      = walletNetwork;

  return (
    <div
      className="w-full flex items-start gap-3 px-4 py-3 rounded-xl"
      style={{
        background: "rgba(239,68,68,0.08)",
        border: "1px solid rgba(239,68,68,0.25)",
      }}
    >
      <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-red-400">Wrong network</p>
        <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>
          Your wallet is on <span className="text-white font-mono">{got}</span> but
          Auron is on <span className="text-white font-mono">{expected}</span>.
        </p>
        <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
          Open Phantom → Settings → Change Network → {expected}
        </p>
      </div>
    </div>
  );
}
