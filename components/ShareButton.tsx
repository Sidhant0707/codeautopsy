"use client";

import { useState } from "react";
import { FaLink, FaCheck } from "react-icons/fa";

export default function ShareButton({ owner, repo }: { owner: string; repo: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    // Dynamically grabs your actual domain (localhost or codeautopsy.com)
    const url = `${window.location.origin}/view/${owner}/${repo}`;
    
    await navigator.clipboard.writeText(url);
    setCopied(true);
    
    setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
  };

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-sm text-white font-medium"
    >
      {copied ? <FaCheck className="text-green-400" /> : <FaLink className="text-slate-400" />}
      {copied ? "Link Copied!" : "Share Autopsy"}
    </button>
  );
}