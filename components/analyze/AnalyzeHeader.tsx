"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Terminal,
  LayoutGrid,
  ThumbsUp,
  ThumbsDown,
  CheckCircle2,
} from "lucide-react";
import { FaGithub } from "react-icons/fa";
import Link from "next/link";
import ExportButton from "@/components/ExportButton";
import ShareButton from "@/components/ShareButton";
import { RepoData } from "@/lib/types/analyze";

interface AnalyzeHeaderProps {
  data: RepoData;
  source: string | null;
  isAiStreaming: boolean;
  feedbackSubmitted: boolean;
  hideFeedback: boolean;
  onBack: () => void;
  onFeedback: (isHelpful: boolean) => void;
}

export default function AnalyzeHeader({
  data,
  source,
  isAiStreaming,
  feedbackSubmitted,
  hideFeedback,
  onBack,
  onFeedback,
}: AnalyzeHeaderProps) {
  return (
    <header className="h-16 flex-shrink-0 border-b border-white/5 bg-[#0e0e0e] flex items-center justify-between px-4 lg:px-6 z-20">
      {/* ── Left: Back + Repo Identity ── */}
      <div className="flex items-center gap-4 sm:gap-6 min-w-0">
        <button
          onClick={onBack}
          aria-label="Go back"
          className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors group flex-shrink-0"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        </button>

        <div className="flex items-center gap-3 min-w-0">
          <FaGithub className="w-5 h-5 text-slate-400 hidden sm:block flex-shrink-0" />

          <h1 className="cabinet text-lg md:text-xl font-bold text-slate-100 flex items-center gap-2 truncate">
            {source === "local" ? (
              "Local Codebase"
            ) : (
              <div className="truncate">
                <span className="text-slate-500 font-medium hidden sm:inline">
                  {data.owner}
                </span>
                <span className="text-slate-600 hidden sm:inline">/</span>
                <span className="truncate">{data.repo}</span>
              </div>
            )}
          </h1>

          <div className="hidden md:flex items-center gap-2 ml-4 px-3 py-1 rounded-full bg-white/[0.02] border border-white/5 flex-shrink-0">
            <Terminal className="w-3 h-3 text-slate-500" />
            <span className="mono text-[10px] text-slate-400 font-bold uppercase">
              {data.language}
            </span>
          </div>

          {/* AI streaming indicator */}
          {isAiStreaming && (
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex-shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="mono text-[9px] text-emerald-400 font-bold uppercase tracking-widest">
                AI Live
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Actions ── */}
      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all font-mono text-[10px] uppercase tracking-widest font-bold h-9 flex-shrink-0"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Dashboard</span>
        </Link>

        {/* Inline feedback widget */}
        <AnimatePresence mode="wait">
          {!hideFeedback && (
            <motion.div
              key={feedbackSubmitted ? "thanks" : "form"}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5, filter: "blur(4px)" }}
              className="hidden sm:flex items-center mr-2"
            >
              {!feedbackSubmitted ? (
                <div className="flex items-center gap-1 bg-white/[0.02] border border-white/5 rounded-lg p-1 h-9 flex-shrink-0">
                  <span className="text-[10px] uppercase font-mono text-slate-500 px-3 font-bold whitespace-nowrap">
                    Helpful?
                  </span>
                  <div className="flex items-center gap-1 px-1">
                    <button
                      onClick={() => onFeedback(true)}
                      aria-label="Mark as helpful"
                      className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-green-400 transition-colors"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onFeedback(false)}
                      aria-label="Mark as not helpful"
                      className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20 h-9 flex-shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-[10px] uppercase font-mono text-green-400 font-bold whitespace-nowrap">
                    Thanks!
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {source !== "local" && (
          <ShareButton owner={data.owner} repo={data.repo} />
        )}
        <ExportButton data={data} />
      </div>
    </header>
  );
}
