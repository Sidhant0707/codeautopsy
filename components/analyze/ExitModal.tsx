"use client";

import { useEffect } from "react";
import type { RefObject } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { useRouter } from "next/navigation";

interface ExitModalProps {
  isOpen: boolean;
  modalRef: RefObject<HTMLDivElement | null>;
  onFeedback: (isHelpful: boolean, exitAfter: boolean) => void;
  onSkip: () => void;
}

export default function ExitModal({
  isOpen,
  modalRef,
  onFeedback,
  onSkip,
}: ExitModalProps) {
  const router = useRouter();

  // Focus trap: keeps keyboard focus inside the modal while it is open.
  useEffect(() => {
    if (!isOpen) return;
    const modal = modalRef.current;
    if (!modal) return;

    const focusable = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };

    first?.focus();
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [isOpen, modalRef]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => router.back()}
          />

          {/* Modal card */}
          <motion.div
            ref={modalRef as RefObject<HTMLDivElement>}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative z-10 glass-card p-6 rounded-2xl border border-white/10 max-w-sm w-full shadow-2xl bg-[#0e0e0e]"
          >
            <h3 className="cabinet text-lg font-bold text-white mb-2 text-center">
              Leaving so soon?
            </h3>
            <p className="text-slate-400 text-xs text-center mb-6">
              Quick check: Was this codebase analysis helpful to you?
            </p>

            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  onClick={() => onFeedback(true, true)}
                  className="flex-1 py-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-colors text-sm font-bold text-slate-300 flex items-center justify-center gap-2"
                >
                  <ThumbsUp className="w-4 h-4" /> Yes
                </button>
                <button
                  onClick={() => onFeedback(false, true)}
                  className="flex-1 py-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-colors text-sm font-bold text-slate-300 flex items-center justify-center gap-2"
                >
                  <ThumbsDown className="w-4 h-4" /> No
                </button>
              </div>
              <button
                onClick={onSkip}
                className="w-full py-2 mt-2 text-xs font-mono tracking-widest uppercase text-slate-500 hover:text-slate-300 transition-colors"
              >
                Skip
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
