"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { usePhantomDeepLink } from "@/hooks/usePhantomDeepLink";
import { shortAddr } from "@/lib/solana";

interface ConnectWalletButtonProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ConnectWalletButton({ className, children }: ConnectWalletButtonProps) {
  const { connected: walletConnected, publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const deepLink = usePhantomDeepLink();

  // Merge both connection sources
  const isConnected = walletConnected || deepLink.isConnected;
  const address = publicKey?.toString() ?? deepLink.publicKey ?? null;

  function handleClick() {
    if (walletConnected) {
      disconnect();
      return;
    }
    if (deepLink.isConnected) {
      deepLink.disconnect();
      return;
    }

    // Not connected — pick connection method
    if (deepLink.isMobileDevice && !deepLink.isInPhantomBrowser) {
      deepLink.connect();   // mobile Chrome → Phantom deep link
    } else {
      setVisible(true);     // desktop or inside Phantom browser → wallet modal
    }
  }

  const shortKey = address ? shortAddr(address) : null;

  return (
    <button onClick={handleClick} className={className}>
      {children ?? (isConnected ? `Connected: ${shortKey}` : "Connect Wallet")}
    </button>
  );
}
