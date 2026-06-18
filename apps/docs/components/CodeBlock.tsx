"use client";

import { useState } from "react";

interface Props {
  code:      string;
  language?: string;
  filename?: string;
}

export default function CodeBlock({ code, language = "ts", filename }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-5 overflow-hidden text-sm" style={{ border: "1px solid var(--border-code)", background: "var(--bg-code)", borderRadius: "6px" }}>
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: "1px solid var(--border-code)", background: "rgba(255,255,255,0.02)" }}
      >
        <div className="flex items-center gap-2.5">
          {/* Traffic dots */}
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#3a3a4a" }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#3a3a4a" }} />
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#3a3a4a" }} />
          </div>
          {filename && (
            <span className="text-xs font-mono ml-1" style={{ color: "var(--text-muted)" }}>{filename}</span>
          )}
          {!filename && (
            <span
              className="text-[10px] uppercase font-medium px-1.5 py-0.5 rounded"
              style={{ background: "var(--bg-elevated)", color: "var(--text-subtle)", letterSpacing: "0.06em" }}
            >
              {language}
            </span>
          )}
        </div>

        <button
          onClick={handleCopy}
          className="text-xs flex items-center gap-1.5 px-2 py-1 rounded transition-colors"
          style={{
            color:      copied ? "var(--green)" : "var(--text-muted)",
            background: "transparent",
          }}
          onMouseEnter={e => { if (!copied) (e.currentTarget as HTMLElement).style.color = "var(--text)"; }}
          onMouseLeave={e => { if (!copied) (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
        >
          {copied ? (
            <>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <path d="M1.5 5.5l2.5 2.5L9 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                <rect x="3.5" y="1" width="6.5" height="7.5" rx="1" stroke="currentColor" strokeWidth="1.1"/>
                <path d="M1 3.5v7a1 1 0 001 1h5.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      {/* Code */}
      <pre
        className="overflow-x-auto p-5 leading-relaxed"
        style={{
          color:      "var(--text-code)",
          fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
          fontSize:   "0.8rem",
          lineHeight: "1.7",
        }}
      >
        <code dangerouslySetInnerHTML={{ __html: highlight(code.trim(), language) }} />
      </pre>
    </div>
  );
}

function highlight(code: string, lang: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  if (lang === "bash" || lang === "sh") {
    return esc(code)
      .replace(/(#[^\n]*)/g, `<span style="color:#4a4a68">$1</span>`)
      .replace(/^(\$ )/gm, `<span style="color:#3a3a58">$1</span>`);
  }

  if (lang === "json") {
    return esc(code)
      .replace(/"([^"]+)"(\s*:)/g, `<span style="color:#90bff0">"$1"</span>$2`)
      .replace(/:\s*"([^"]*)"/g, `: <span style="color:#a5d6a7">"$1"</span>`)
      .replace(/:\s*(true|false|null)\b/g, `: <span style="color:#c792ea">$1</span>`)
      .replace(/:\s*(-?\d+\.?\d*)/g, `: <span style="color:#ffcc80">$1</span>`);
  }

  // TypeScript / JavaScript
  return esc(code)
    .replace(/(\/\/[^\n]*)/g, `<span style="color:#4a4a68">$1</span>`)
    .replace(/(`[^`\n]*`)/g, `<span style="color:#a5d6a7">$1</span>`)
    .replace(/"([^"\n]*)"/g, `<span style="color:#a5d6a7">"$1"</span>`)
    .replace(/'([^'\n]*)'/g, `<span style="color:#a5d6a7">'$1'</span>`)
    .replace(/\b(import|export|from|const|let|async|await|return|throw|new|if|else|try|catch|type|interface|default|function|class|extends)\b/g,
      `<span style="color:#c792ea">$1</span>`)
    .replace(/\b(string|number|boolean|void|null|undefined|Promise|true|false)\b/g,
      `<span style="color:#80cbc4">$1</span>`)
    .replace(/\b([A-Z][a-zA-Z0-9]*)\b/g, `<span style="color:#d2a8ff">$1</span>`)
    .replace(/\b(\w+)(?=\s*\()/g, `<span style="color:#79c0ff">$1</span>`);
}
