"use client";

import { useState } from "react";
import { Activity } from "lucide-react";

interface DebugFormProps {
  onSubmit: (errorQuery: string) => void;
  isLoading: boolean;
}

export function DebugForm({ onSubmit, isLoading }: DebugFormProps) {
  const [errorQuery, setErrorQuery] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!errorQuery.trim() || isLoading) return;
    onSubmit(errorQuery);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      {/* QUICK TEST SECTION */}
      <div className="flex items-center gap-4 mb-6">
        <span className="mono text-[10px] uppercase tracking-widest text-slate-600 font-bold">
          Quick Test:
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              setErrorQuery(
                "TypeError: Cannot read properties of undefined (reading 'map') at UserList",
              )
            }
            className="px-3 py-1.5 rounded-md text-xs font-mono text-slate-400 bg-[#0a0a0a] border border-white/5 hover:bg-white/5 hover:text-white transition-all"
          >
            TypeError
          </button>
          <button
            type="button"
            onClick={() =>
              setErrorQuery(
                "ReferenceError: process is not defined in browser context",
              )
            }
            className="px-3 py-1.5 rounded-md text-xs font-mono text-slate-400 bg-[#0a0a0a] border border-white/5 hover:bg-white/5 hover:text-white transition-all"
          >
            ReferenceError
          </button>
        </div>
      </div>

      {/* INPUT SECTION */}
      <div className="mb-6">
        <label className="block mb-3 text-sm font-medium text-slate-400">
          Paste your stack trace or error message
        </label>
        <div className="relative group/input">
          <div className="absolute -inset-0.5 bg-gradient-to-b from-white/10 to-transparent rounded-xl opacity-0 group-focus-within/input:opacity-100 transition duration-500" />
          <textarea
            value={errorQuery}
            onChange={(e) => setErrorQuery(e.target.value)}
            disabled={isLoading}
            className="relative w-full h-40 bg-[#050505] border border-white/10 rounded-xl p-5 text-slate-300 font-mono text-sm focus:outline-none focus:border-white/30 transition-colors resize-none leading-relaxed placeholder:text-slate-700 disabled:opacity-50 shadow-inner"
            placeholder="TypeError: Cannot read properties of undefined (reading 'map') at UserList (components/UserList.tsx:42:15)"
          />
        </div>
        <div className="flex items-center gap-2 mt-3 ml-2">
          <span className="text-slate-500 text-xs">💡</span>
          <p className="text-xs text-slate-500">
            Include file paths and line numbers for best results
          </p>
        </div>
      </div>

      {/* STEALTH GRAYSCALE BUTTON */}
      <button
        type="submit"
        disabled={isLoading || !errorQuery.trim()}
        className="w-full relative group/btn overflow-hidden rounded-xl p-[1px] bg-white/10 hover:bg-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[100%] group-hover/btn:translate-x-[100%] transition-transform duration-1000" />
        <div className="relative flex items-center justify-center gap-3 bg-[#0a0a0a] px-6 py-4 rounded-xl transition-all shadow-lg group-hover/btn:shadow-[0_0_15px_rgba(255,255,255,0.05)] group-hover/btn:bg-[#111]">
          <Activity className="w-4 h-4 text-slate-500 group-hover/btn:text-white transition-colors" />
          <span className="text-sm font-bold text-slate-300 font-mono uppercase tracking-widest group-hover/btn:text-white transition-colors">
            {isLoading ? "Analyzing Crash..." : "Initiate Diagnostics"}
          </span>
        </div>
      </button>
    </form>
  );
}
