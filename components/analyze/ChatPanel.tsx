"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Terminal, MessageSquare, X } from "lucide-react";
import dynamic from "next/dynamic";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { EXPO_OUT } from "@/components/analyze/constants";
import { RepoData } from "@/lib/types/analyze";
import SkeletonLoader from "@/components/analyze/SkeletonLoader";

const RepoChat = dynamic(() => import("@/components/RepoChat"), {
  loading: () => <SkeletonLoader />,
  ssr: false,
});

interface ChatPanelProps {
  data: RepoData;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export default function ChatPanel({
  data,
  isOpen,
  onOpen,
  onClose,
}: ChatPanelProps) {
  return (
    <>
      {/* Floating toggle button — visible only when panel is closed */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            type="button"
            initial={{ x: 100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 100, opacity: 0 }}
            onClick={onOpen}
            aria-label="Open chat assistant"
            className="absolute right-0 bottom-8 z-40 flex items-center gap-3 bg-[#141414]/90 backdrop-blur-md border border-white/10 border-r-0 px-4 py-4 rounded-l-2xl shadow-[-10px_0_30px_rgba(0,0,0,0.5)] hover:bg-[#1a1a1a] hover:pr-6 transition-all group"
          >
            <div className="relative">
              <MessageSquare className="w-5 h-5 text-slate-300 group-hover:text-white transition-colors" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            </div>
            <div className="flex-col text-left hidden sm:flex">
              <span className="font-bold text-xs text-white">Need Help?</span>
              <span className="font-mono text-[9px] uppercase tracking-widest text-slate-500">
                Ask Copilot
              </span>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Slide-in panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "min(100vw, 420px)", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: EXPO_OUT }}
            className="h-full flex-shrink-0 border-l border-white/5 bg-[#0a0a0a] flex flex-col z-50 absolute right-0 sm:relative shadow-[-20px_0_40px_rgba(0,0,0,0.5)]"
            style={{ willChange: "width, opacity" }}
          >
            {/* Panel header */}
            <div className="h-12 flex-shrink-0 border-b border-white/5 flex items-center justify-between px-4 bg-[#0e0e0e]">
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-slate-400" />
                <h3 className="text-[11px] font-bold text-slate-300 uppercase tracking-widest font-mono">
                  Autopsy Copilot
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md hover:bg-white/10 text-slate-500 hover:text-white transition-colors"
                aria-label="Close chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat content */}
            <div className="flex-1 min-h-0 bg-transparent">
              <ErrorBoundary fallbackMessage="Copilot encountered a critical error.">
                <RepoChat
                  repoContext={
                    data as unknown as {
                      repo?: string;
                      [key: string]: string | undefined;
                    }
                  }
                />
              </ErrorBoundary>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
