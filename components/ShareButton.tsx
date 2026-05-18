"use client";

import { useState } from "react";
import { Share2, Check, AlertCircle } from "lucide-react";

interface ShareButtonProps {
  owner: string;
  repo: string;
}

export default function ShareButton({ owner, repo }: ShareButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");

  const handleShare = async () => {
    // Prevent spam clicking while already animating
    if (status !== "idle") return;

    try {
      // --- PRINCIPAL UPGRADE 1: URL Safety ---
      const safeOwner = encodeURIComponent(owner);
      const safeRepo = encodeURIComponent(repo);
      const shareUrl = `${window.location.origin}/view/${safeOwner}/${safeRepo}`;

      // --- PRINCIPAL UPGRADE 2: Native Share Sheet (Mobile-First Viral Loop) ---
      // If the browser supports native sharing (usually mobile/macOS), trigger it.
      if (navigator.share) {
        try {
          await navigator.share({
            title: `${owner}/${repo} - CodeAutopsy Report`,
            text: `Check out the architectural map for ${owner}/${repo} on CodeAutopsy.`,
            url: shareUrl,
          });
          // If native share succeeds, we exit early
          return;
        } catch (shareErr) {
          // If the user manually dismisses the share sheet, it throws an AbortError.
          // We silently ignore aborts, but fallback to clipboard for other errors.
          if (shareErr instanceof Error && shareErr.name === "AbortError") {
            return;
          }
          console.warn(
            "Native share rejected/failed, falling back to clipboard.",
          );
        }
      }

      // --- PRINCIPAL UPGRADE 3: Safe Clipboard Fallback ---
      if (!navigator?.clipboard) {
        throw new Error("Clipboard API not available in this context.");
      }

      await navigator.clipboard.writeText(shareUrl);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  return (
    <button
      onClick={handleShare}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-mono text-[10px] uppercase tracking-widest font-bold h-9 flex-shrink-0 ${
        status === "copied"
          ? "bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
          : status === "error"
            ? "bg-rose-500/20 hover:bg-rose-500/30 border-rose-500/30 text-rose-400"
            : "bg-white/5 hover:bg-white/10 border-white/10 text-slate-300 hover:text-white shadow-lg"
      }`}
      aria-live="polite"
    >
      {status === "copied" ? (
        <Check className="w-3.5 h-3.5 stroke-[3]" />
      ) : status === "error" ? (
        <AlertCircle className="w-3.5 h-3.5 stroke-[2.5]" />
      ) : (
        <Share2 className="w-3.5 h-3.5 stroke-[2]" />
      )}

      <span>
        {status === "copied"
          ? "Copied!"
          : status === "error"
            ? "Failed"
            : "Share Autopsy"}
      </span>
    </button>
  );
}
