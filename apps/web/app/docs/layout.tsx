import type { Metadata } from "next";
import DocsSidebar from "@/components/docs/Sidebar";
import DocsTopNav  from "@/components/docs/TopNav";
import "./docs.css";

export const metadata: Metadata = {
  title:       { default: "Auron Docs", template: "%s — Auron Docs" },
  description: "Auron developer documentation — USDC payments on Solana, settled as INR via UPI.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="docs-scope min-h-screen" style={{ background: "var(--bg)" }}>
      <DocsSidebar />
      <DocsTopNav />
      <main className="ml-[260px] pt-14">
        <div className="max-w-3xl mx-auto px-12 py-14">
          {children}
        </div>
      </main>
    </div>
  );
}
