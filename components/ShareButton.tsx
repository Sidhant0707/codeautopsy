"use client";

import { useState } from "react";
import { FaLink, FaCheck } from "react-icons/fa";

export default function ShareButton({ owner, repo }: { owner: string; repo: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    
    const url = `${window.location.origin}/view/${owner}/${repo}`;
    
    await navigator.clipboard.writeText(url);
    setCopied(true);
    
    setTimeout(() => setCopied(false), 2000); 
  };

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all font-mono text-[10px] uppercase tracking-widest font-bold h-9 flex-shrink-0"
    >
      {copied ? <FaCheck className="text-green-400 w-3.5 h-3.5" /> : <FaLink className="text-slate-400 w-3.5 h-3.5" />}
      <span>{copied ? "Copied!" : "Share Autopsy"}</span>
    </button>
  );
}