"use client";

import { useEffect, useState } from "react";
import { useDebugAnalysis } from "@/hooks/use-debug";
import { DebugForm } from "./DebugForm";
import { DebugResults } from "./DebugResults";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { motion } from "framer-motion";
import { AlertCircle, Cpu, Maximize2, Minimize2 } from "lucide-react";

export default function DebugInterface({ repoUrl }: { initialChart?: string; repoUrl: string }) {
  const { analyzeCrash, result, isLoading, error, reset } = useDebugAnalysis(repoUrl);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMaximized(false);
    };
    if (isMaximized) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleEscape);
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isMaximized]);

  return (
    <>
      {isMaximized && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[90]"
          onClick={() => setIsMaximized(false)}
        />
      )}

      <div
        className={`bg-transparent overflow-hidden group transition-all duration-500 ${
          isMaximized
            ? "fixed inset-4 md:inset-8 z-[100] h-[calc(100vh-32px)] md:h-[calc(100vh-64px)] w-[calc(100vw-32px)] md:w-[calc(100vw-64px)] m-auto flex flex-col bg-[#0a0a0a] rounded-3xl border border-white/10 shadow-2xl"
            : "relative w-full h-full flex flex-col"
        }`}
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#111_1px,transparent_1px),linear-gradient(to_bottom,#111_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none z-0" />
        <motion.div initial={{ top: "-50%" }} animate={{ top: "150%" }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} className="absolute left-0 right-0 h-[400px] pointer-events-none z-0 flex flex-col justify-center">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent blur-sm" />
          <div className="w-full h-[1px] bg-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.5)] relative z-10" />
        </motion.div>
        <div className="absolute inset-0 shadow-[inset_0_0_100px_rgba(0,0,0,1)] pointer-events-none z-0" />

        <button
          onClick={() => setIsMaximized(!isMaximized)}
          className="absolute top-6 right-6 z-50 p-2.5 bg-black/40 border border-white/10 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all backdrop-blur-md"
        >
          {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        <div className="relative z-10 p-6 md:p-8 flex-1 min-h-0 flex flex-col overflow-hidden">

          <div className="flex flex-col gap-3 mb-6 pb-6 border-b border-white/5 flex-shrink-0 pr-12">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#0a0a0a] border border-white/10 flex items-center justify-center shadow-inner relative overflow-hidden flex-shrink-0">
                <Cpu className="w-6 h-6 text-slate-300 relative z-10" />
              </div>
              <h2 className="cabinet text-2xl md:text-3xl font-bold text-white tracking-tight">
                CodeAutopsy Diagnostic Engine <span className="text-slate-600 font-mono text-sm ml-2 align-top">v1.0</span>
              </h2>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-mono uppercase tracking-[0.2em] ml-16">
              [ SYSTEM STATUS: <span className="text-green-500 font-bold animate-pulse">ONLINE</span> ] <span className="hidden sm:inline text-slate-700 mx-2">•</span> Powered by graph traversal + AI reasoning
            </p>
          </div>

          <div className="relative z-10 flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar pr-2">

            {error && (
              <div className="mb-6 p-4 bg-red-900/20 border border-red-500/20 backdrop-blur-md rounded-xl text-red-200 text-sm flex gap-3 items-start flex-shrink-0">
                <span className="text-lg"><AlertCircle className="w-4 h-4 text-red-400"/></span>
                <div className="flex-1">
                  <p className="font-medium mb-1">Diagnosis Failed</p>
                  <p className="text-xs text-red-400/70">{error}</p>
                  <button onClick={reset} className="mt-3 text-xs text-red-400 hover:text-red-300 underline font-mono transition-colors">{">"} REBOOT_DIAGNOSIS</button>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="mb-6 p-4 bg-[#0a0a0a]/80 border border-white/10 rounded-xl font-mono text-xs text-slate-400 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xl backdrop-blur-md flex-shrink-0">
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                  <span>🔍 DEPTH_SEARCH: <span className="text-white font-bold">ACTIVE</span></span>
                  <span className="hidden sm:inline text-slate-700">|</span>
                  <span>NODES_SCANNED: INCREASING...</span>
                </div>
                <span className="animate-pulse text-white flex items-center gap-2"><span className="w-2 h-2 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]" /> ANALYZING_FLOW...</span>
              </div>
            )}

            <div className="flex-1 flex flex-col min-h-0 w-full h-full">
              {isLoading ? (
                <LoadingSkeleton />
              ) : result ? (
                <DebugResults result={result} onReset={reset} />
              ) : (
                <DebugForm onSubmit={analyzeCrash} isLoading={isLoading} />
              )}
            </div>

          </div>
        </div>
      </div>
    </>
  );
}