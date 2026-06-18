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
    <div
      className="my-5 overflow-hidden"
      style={{ background: "var(--terminal)", border: "1px solid var(--border)", borderRadius: 10 }}
    >
      {/* Terminal header — matches Auron app style */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-2.5">
          {/* Traffic dots */}
          <div className="flex items-center gap-1.5">
            {["#3F3F46", "#3F3F46", "#3F3F46"].map((c, i) => (
              <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
            ))}
          </div>
          {filename ? (
            <span
              style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "var(--text-dim)", marginLeft: 8 }}
            >
              {filename}
            </span>
          ) : (
            <span
              style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: 10,
                color: "var(--text-dim)",
                letterSpacing: "0.08em",
                marginLeft: 8,
                textTransform: "uppercase",
              }}
            >
              {language}
            </span>
          )}
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 transition-colors"
          style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: 11,
            color: copied ? "var(--lime)" : "var(--text-dim)",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
          onMouseEnter={e => { if (!copied) (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
          onMouseLeave={e => { if (!copied) (e.currentTarget as HTMLElement).style.color = "var(--text-dim)"; }}
        >
          {copied ? "✓ COPIED" : "COPY"}
        </button>
      </div>

      {/* Code body */}
      <pre
        className="overflow-x-auto p-5"
        style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: "0.78rem",
          lineHeight: 1.75,
          color: "#A1A1AA",
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
      .replace(/(#[^\n]*)/g, `<span style="color:#3F3F46">$1</span>`)
      .replace(/^(\$ )/gm, `<span style="color:#3F3F46">$1</span>`)
      .replace(/(npm|yarn|pnpm)\b/g, `<span style="color:#C8F135">$1</span>`);
  }

  if (lang === "json") {
    return esc(code)
      .replace(/"([^"]+)"(\s*:)/g, `<span style="color:#A1A1AA">"$1"</span>$2`)
      .replace(/:\s*"([^"]*)"/g, `: <span style="color:#C8F135">"$1"</span>`)
      .replace(/:\s*(true|false|null)\b/g, `: <span style="color:#F5A623">$1</span>`)
      .replace(/:\s*(-?\d+\.?\d*)/g, `: <span style="color:#2775CA">$1</span>`);
  }

  // TypeScript / JavaScript
  return esc(code)
    .replace(/(\/\/[^\n]*)/g, `<span style="color:#3F3F46">$1</span>`)
    .replace(/(`[^`\n]*`)/g, `<span style="color:#C8F135">$1</span>`)
    .replace(/"([^"\n]*)"/g, `<span style="color:#C8F135">"$1"</span>`)
    .replace(/'([^'\n]*)'/g, `<span style="color:#C8F135">'$1'</span>`)
    .replace(/\b(import|export|from|const|let|async|await|return|throw|new|if|else|try|catch|type|interface|default|function|class|extends)\b/g,
      `<span style="color:#71717A">$1</span>`)
    .replace(/\b(string|number|boolean|void|null|undefined|Promise|true|false)\b/g,
      `<span style="color:#F5A623">$1</span>`)
    .replace(/\b([A-Z][a-zA-Z0-9]*)\b/g, `<span style="color:#FAFAF9">$1</span>`)
    .replace(/\b(\w+)(?=\s*\()/g, `<span style="color:#A1A1AA">$1</span>`);
}
