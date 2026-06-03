import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter, DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Auron — Your money, your words.",
    template: "%s | Auron",
  },
  description:
    "Type what you want. Auron handles it — securely, instantly, on-chain. Send money, save agreements, lock savings, prove ownership. No crypto knowledge needed.",
  keywords: [
    "blockchain", "Solana", "crypto", "AI", "send money",
    "Web3", "India", "conversational crypto", "USDC", "Jupiter",
  ],
  authors: [{ name: "Auron" }],
  creator: "Auron",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://auron.xyz"),
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "/",
    siteName: "Auron",
    title: "Auron — Your money, your words.",
    description: "Type what you want. The blockchain does it. Invisibly.",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Auron" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Auron — Your money, your words.",
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
  themeColor: "#09090B",
  width: "device-width",
  initialScale: 1,
  // maximumScale removed — user zoom is an accessibility right (WCAG 1.4.4)
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${dmSans.variable} ${jetbrainsMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="h-full antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
