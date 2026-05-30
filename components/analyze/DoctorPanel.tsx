// components/analyze/DoctorPanel.tsx

"use client";

import { motion } from "framer-motion";
import { Terminal, MessageSquare } from "lucide-react";
import dynamic from "next/dynamic";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { RepoData } from "@/lib/types/analyze";
import SkeletonLoader from "@/components/analyze/SkeletonLoader";
import AiGate from "@/components/analyze/AiGate";

const DebugInterface = dynamic(
  () => import("@/components/debug/DebugInterface"),
  { loading: () => <SkeletonLoader />, ssr: false },
);

interface DoctorPanelProps {
  data: RepoData;
  source: string | null;
  onOpenChat: () => void;
  aiGateState: "free" | "login-required" | "limit-reached" | null;
  isPro: boolean;
  diagnosticCount: number;
}

export default function DoctorPanel({
  data,
  source,
  onOpenChat,
  aiGateState,
  isPro,
  diagnosticCount,
}: DoctorPanelProps) {
  const repoUrl =
    source === "local"
      ? "Local.zip Codebase"
      : `https://github.com/${data.owner}/${data.repo}`;

  const githubRepoUrl =
    source === "local"
      ? undefined
      : `https://github.com/${data.owner}/${data.repo}`;

  return (
    <motion.div
      key="doctor"
      role="tabpanel"
      id="tabpanel-doctor"
      aria-labelledby="tab-doctor"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.8 }}
      className="absolute inset-0 overflow-hidden p-4"
    >
      <div className="flex flex-col gap-4 h-full">
        {data.mermaidDiagram ? (
          <>
            <div className="w-full flex-1 min-h-0 rounded-2xl border border-white/5 overflow-hidden bg-[#0e0e0e] relative">
              <ErrorBoundary fallbackMessage="Diagnostic interface crashed.">
                <DebugInterface
                  repoUrl={repoUrl}
                  isPro={isPro}
                  diagnosticCount={diagnosticCount}
                />
              </ErrorBoundary>

              {(aiGateState === "login-required" ||
                aiGateState === "limit-reached") && (
                <AiGate
                  state={
                    aiGateState === "login-required"
                      ? "auth_required"
                      : "limit_reached"
                  }
                  repoUrl={githubRepoUrl}
                />
              )}
            </div>

            <motion.button
              whileTap={{ scale: 0.99 }}
              onClick={onOpenChat}
              className="w-full flex-shrink-0 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center justify-center gap-3 group shadow-lg"
            >
              <MessageSquare className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
              <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">
                Discuss this diagnosis in Copilot &rarr;
              </span>
            </motion.button>
          </>
        ) : (
          <div className="w-full h-full rounded-2xl border border-white/5 bg-[#0e0e0e] flex flex-col items-center justify-center min-h-[600px] p-4 text-center">
            <Terminal className="w-10 h-10 text-slate-600 mb-4" />
            <p className="text-slate-500 font-mono text-xs">
              Diagnostic core offline.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
