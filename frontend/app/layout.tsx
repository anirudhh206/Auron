import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// ── SEO + OpenGraph metadata ──────────────────────────────────────
export const metadata: Metadata = {
  title: {
    default: "Auron — The blockchain that disappears.",
    template: "%s | Auron",
  },
  description:
    "Type what you want. Send money, save agreements, lock savings, prove ownership — all on-chain, all invisible. No crypto knowledge needed.",
  keywords: [
    "blockchain",
    "Initia",
    "crypto",
    "AI",
    "send money",
    "Web3",
    "India",
    "conversational crypto",
    
  ],
  authors: [{ name: "Auron" }],
  creator: "Auron",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://auron.xyz"
  ),
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/",
    siteName: "Auron",
    title: "Auron — The blockchain that disappears.",
    description:
      "Type what you want. The blockchain does it. Invisibly.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Auron — The blockchain that disappears.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Auron — The blockchain that disappears.",
    description: "Type what you want. The blockchain does it. Invisibly.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#030712",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="h-full bg-[#030712] text-white antialiased font-[var(--font-inter)]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
