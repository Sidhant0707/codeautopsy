"use client";

import { useState } from "react";
import { Copy, Check, AlertCircle } from "lucide-react";

interface BadgeEmbedProps {
  repoName: string;
}

export function BadgeEmbed({ repoName }: BadgeEmbedProps) {
  const [format, setFormat] = useState<"html" | "markdown">("html");
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">(
    "idle",
  );

  // --- PRINCIPAL UPGRADE: XSS Defense via encodeURIComponent ---
  const safeRepoName = encodeURIComponent(repoName);

  const analyzeUrl = `https://codeautopsy-lyart.vercel.app/analyze?repo=${safeRepoName}`;
  const badgeUrl = `https://codeautopsy-lyart.vercel.app/api/badge?repo=${safeRepoName}&v=1`;

  const markdownCode = `[![CodeAutopsy Health](${badgeUrl})](${analyzeUrl})`;
  const htmlCode = `<a href="${analyzeUrl}">\n  <img src="${badgeUrl}" alt="CodeAutopsy Health" />\n</a>`;

  const activeCode = format === "html" ? htmlCode : markdownCode;

  // --- PRINCIPAL UPGRADE: Resilient Clipboard API ---
  const handleCopy = async () => {
    try {
      if (!navigator?.clipboard) {
        throw new Error("Clipboard API not available");
      }
      await navigator.clipboard.writeText(activeCode);
      setCopyStatus("copied");
      setTimeout(() => setCopyStatus("idle"), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
      setCopyStatus("error");
      setTimeout(() => setCopyStatus("idle"), 3000);
    }
  };

  return (
    <div className="mt-6 border border-white/[0.08] rounded-xl p-5 bg-[#0a0a0a]/90 backdrop-blur-md shadow-xl relative overflow-hidden group">
      {/* Subtle background glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.02] to-transparent pointer-events-none" />

      <div className="flex items-center justify-between mb-4 relative z-10">
        <h3 className="text-sm font-bold text-slate-200 tracking-tight flex items-center gap-2">
          Embed Health Badge
        </h3>

        <div className="flex items-center bg-[#141414] rounded-lg p-1 border border-white/[0.08] shadow-inner">
          <button
            onClick={() => setFormat("html")}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all duration-200 ${
              format === "html"
                ? "bg-white/[0.08] text-emerald-400 shadow-sm border border-white/[0.04]"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            HTML
          </button>
          <button
            onClick={() => setFormat("markdown")}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all duration-200 ${
              format === "markdown"
                ? "bg-white/[0.08] text-emerald-400 shadow-sm border border-white/[0.04]"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            Markdown
          </button>
        </div>
      </div>

      <div className="relative group/code z-10">
        <pre className="p-4 rounded-xl bg-[#0e0e0e] text-slate-300 text-sm overflow-x-auto border border-white/[0.05] font-mono whitespace-pre-wrap break-all transition-all duration-300 group-hover/code:border-white/[0.1] shadow-inner">
          <code>{activeCode}</code>
        </pre>

        <button
          onClick={handleCopy}
          className={`absolute top-3 right-3 p-2.5 rounded-lg transition-all duration-200 backdrop-blur-sm border ${
            copyStatus === "copied"
              ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400"
              : copyStatus === "error"
                ? "bg-rose-500/20 border-rose-500/30 text-rose-400"
                : "bg-[#141414]/80 border-white/[0.08] text-slate-400 hover:text-white hover:bg-white/[0.08] opacity-0 group-hover/code:opacity-100"
          }`}
          title="Copy to clipboard"
        >
          {copyStatus === "copied" ? (
            <Check size={16} strokeWidth={3} />
          ) : copyStatus === "error" ? (
            <AlertCircle size={16} strokeWidth={2} />
          ) : (
            <Copy size={16} strokeWidth={2} />
          )}
        </button>
      </div>
    </div>
  );
}
