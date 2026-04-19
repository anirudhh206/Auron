"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InterwovenKitProvider } from "@initia/interwovenkit-react";

const CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID ?? "auron-1";

// Auron Minitia chain config for InterwovenKit
const INTERWOVENKIT_CONFIG = {
  defaultChainId: CHAIN_ID,
  registryUrl: "https://registry.initia.xyz",
  routerApiUrl: "https://router.initia.xyz",
  glyphUrl: "https://glyph.initia.xyz",
  usernamesModuleAddress: "0x4e86b144df8e7c14f5fe9c4e3ff1e11b2b3b7ef5",
  lockStakeModuleAddress: "0x0000000000000000000000000000000000000001",
  minityUrl: "https://minitia.xyz",
  dexUrl: "https://dex.initia.xyz",
  vipUrl: "https://vip.initia.xyz",
  theme: "dark" as const,
  disableAnalytics: false,
  // Layer 1: Auto-signing — users pre-approve Auron contracts so they
  // never see a wallet popup for routine actions
  enableAutoSign: true,
};

export default function Providers({ children }: { readonly children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,       // 30s — chain data stays fresh
            retry: 2,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <InterwovenKitProvider {...INTERWOVENKIT_CONFIG}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </InterwovenKitProvider>
  );
}
