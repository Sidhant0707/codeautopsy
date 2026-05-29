"use client";

import { motion } from "framer-motion";
import { Cpu } from "lucide-react";
import { LOADING_PHRASES } from "@/components/analyze/constants";
import type { LoadingControls } from "@/hooks/analyze/useLoadingAnimation";

interface AnalyzeLoadingScreenProps {
  repoUrl: string | null;
  source: string | null;
  loadingStep: number;
  loadingControls: LoadingControls;
}

export default function AnalyzeLoadingScreen({
  repoUrl,
  source,
  loadingStep,
  loadingControls,
}: AnalyzeLoadingScreenProps) {
  return (
    <div className="h-screen w-screen bg-[#0a0a0a] flex flex-col items-center justify-center relative overflow-hidden text-slate-200 font-satoshi">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-white/[0.01] rounded-full blur-[80px] animate-pulse" />
      <div className="relative z-10 glass-card p-8 rounded-2xl border border-white/5 max-w-sm w-full mx-4 shadow-2xl">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/5">
          <div className="w-10 h-10 rounded-xl bg-[#141414] border border-white/10 flex items-center justify-center shadow-inner">
            <Cpu className="w-5 h-5 text-slate-400" />
          </div>
          <div>
            <h3 className="cabinet font-bold text-lg text-white">
              Performing Autopsy
            </h3>
            <p className="mono text-[10px] text-slate-500 tracking-widest uppercase truncate max-w-[200px]">
              {source === "local"
                ? "Local.zip Upload"
                : repoUrl?.split("/").slice(-2).join("/") || "Repository"}
            </p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded flex items-center justify-center bg-emerald-500/20 border border-emerald-500/50">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <motion.span
              animate={loadingControls}
              className="mono text-xs text-emerald-400 font-medium"
            >
              {LOADING_PHRASES[loadingStep]}
            </motion.span>
          </div>
        </div>
      </div>
    </div>
  );
}
