"use client";

import { useMemo, useState, useEffect, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RPC_ENDPOINT } from "@/lib/solana";
import { initNotifications } from "@/lib/notifications";

// Required CSS for the Solana wallet modal
import "@solana/wallet-adapter-react-ui/styles.css";

export default function Providers({ children }: { readonly children: ReactNode }) {
  // Phantom is explicit; Backpack, Solflare, and any Wallet Standard
  // compatible wallet auto-registers without a separate adapter
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 2,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  useEffect(() => {
    initNotifications().catch(console.error);
    // If MetaMask was previously stored as the selected wallet (via Wallet
    // Standard auto-discovery), clear it so autoConnect targets Phantom only.
    const stored = localStorage.getItem("walletName");
    if (stored && stored !== "Phantom") localStorage.removeItem("walletName");
  }, []);

  return (
    <ConnectionProvider
      endpoint={RPC_ENDPOINT}
      config={{ commitment: "confirmed" }}
    >
      <WalletProvider
          wallets={wallets}
          autoConnect
          onError={(err) => {
            // MetaMask v11+ registers itself via the Wallet Standard Solana
            // interface and throws when our Phantom-only app tries to connect.
            // Suppress it — the user never selected MetaMask intentionally.
            if (err.message?.includes("MetaMask")) return;
            console.error("[wallet]", err);
          }}
        >
        <WalletModalProvider>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
