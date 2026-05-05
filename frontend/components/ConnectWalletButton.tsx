"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useEffect, useState } from "react";
import { buildPhantomConnectUrl, isMobile, isPhantomBrowser } from "@/lib/phantom-deeplink";

interface ConnectWalletButtonProps {
  className?: string;
  children?: React.ReactNode;
}

export default function ConnectWalletButton({ className, children }: ConnectWalletButtonProps) {
  const { connected, publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [mobile, setMobile] = useState(false);
  const [inPhantomBrowser, setInPhantomBrowser] = useState(false);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://auron-mocha.vercel.app";
  const cluster = (process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? "devnet") as "devnet" | "mainnet-beta";

  useEffect(() => {
    setMobile(isMobile());
    setInPhantomBrowser(isPhantomBrowser());
  }, []);

  function handleConnect() {
    if (connected) {
      disconnect();
      return;
    }

    // Inside Phantom browser — use standard adapter
    if (inPhantomBrowser) {
      setVisible(true);
      return;
    }

    // Mobile outside Phantom browser — use deep link
    if (mobile) {
      const connectUrl = buildPhantomConnectUrl(appUrl, cluster);
      window.location.href = connectUrl;
      return;
    }

    // Desktop — use standard wallet modal
    setVisible(true);
  }

  const shortKey = publicKey
    ? `${publicKey.toString().slice(0, 4)}…${publicKey.toString().slice(-4)}`
    : null;

  return (
    <button onClick={handleConnect} className={className}>
      {children ?? (connected ? `Connected: ${shortKey}` : "Connect Wallet")}
    </button>
  );
}
