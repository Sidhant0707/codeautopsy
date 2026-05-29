"use client";

import { motion } from "framer-motion";
import { Layers, Terminal, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

interface AnalyzeErrorScreenProps {
  error: string;
  isRateLimit: boolean;
}

export default function AnalyzeErrorScreen({
  error,
  isRateLimit,
}: AnalyzeErrorScreenProps) {
  const router = useRouter();

  return (
    <div className="h-screen w-screen bg-[#0a0a0a] flex flex-col items-center justify-center font-satoshi p-4">
      <div
        className={`glass-card p-8 rounded-2xl max-w-lg w-full text-center border ${
          isRateLimit ? "border-amber-500/20" : "border-red-500/10"
        }`}
      >
        <div
          className={`w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-6 border ${
            isRateLimit
              ? "bg-amber-500/10 border-amber-500/20"
              : "bg-red-500/10 border-red-500/20"
          }`}
        >
          {isRateLimit ? (
            <Layers className="w-6 h-6 text-amber-400" />
          ) : (
            <Terminal className="w-6 h-6 text-red-400" />
          )}
        </div>

        <h2 className="cabinet text-2xl font-bold text-white mb-4">
          {isRateLimit ? "Daily Limit Reached" : "Autopsy Failed"}
        </h2>

        <div className="w-full max-h-[200px] overflow-y-auto custom-scrollbar p-4 mb-8 rounded-lg bg-[#0e0e0e] border border-white/5 shadow-inner text-left">
          <p className="text-xs leading-relaxed font-mono text-red-400 break-words whitespace-pre-wrap">
            {error}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {isRateLimit && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push("/pricing")}
              className="w-full px-6 py-3 rounded-xl bg-white text-black font-bold text-sm hover:scale-[1.02] transition-transform"
            >
              View Upgrade Options
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => router.back()}
            className="w-full px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-bold text-white transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Go Back
          </motion.button>
        </div>
      </div>
    </div>
  );
}
