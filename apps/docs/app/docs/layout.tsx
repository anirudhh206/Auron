import Sidebar from "@/components/Sidebar";
import TopNav  from "@/components/TopNav";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <Sidebar />
      <TopNav />
      <main className="ml-[260px] pt-14">
        <div className="max-w-3xl mx-auto px-12 py-14">
          {children}
        </div>
      </main>
    </div>
  );
}
