"use client";

import { useEffect, useRef, useState } from "react";
import { useDebugAnalysis } from "@/hooks/use-debug";
import { DebugForm } from "./DebugForm";
import { DebugResults } from "./DebugResults";
import { LoadingSkeleton } from "./LoadingSkeleton";
import { motion } from "framer-motion";
import { Cpu, Maximize2, Minimize2, AlertCircle, Search } from "lucide-react";

interface CodeDoctorPanelProps {
  repoUrl: string;
  onUpdateGraph?: (newMermaidString: string) => void;
}

export function CodeDoctorPanel({
  repoUrl,
  onUpdateGraph,
}: CodeDoctorPanelProps) {
  const { analyzeCrash, result, isLoading, error, reset } =
    useDebugAnalysis(repoUrl);

  const [isMaximized, setIsMaximized] = useState(false);

  // --- PRINCIPAL UPGRADE: DOM Refs for Focus Trap ---
  const panelRef = useRef<HTMLDivElement>(null);
  const maximizeButtonRef = useRef<HTMLButtonElement>(null);

  // --- PRINCIPAL UPGRADE: The "Latest Ref" Pattern ---
  // Safely stores the latest callback without triggering re-renders
  // if the parent forgets to use useCallback.
  const onUpdateGraphRef = useRef(onUpdateGraph);
  const lastChartRef = useRef<string | null>(null);

  useEffect(() => {
    onUpdateGraphRef.current = onUpdateGraph;
  }, [onUpdateGraph]);

  useEffect(() => {
    const currentMermaid = result?.highlighted_mermaid;
    if (currentMermaid && currentMermaid !== lastChartRef.current) {
      lastChartRef.current = currentMermaid;
      if (onUpdateGraphRef.current) {
        onUpdateGraphRef.current(currentMermaid);
      }
    }
  }, [result?.highlighted_mermaid]); // Removed function dependency entirely!

  // --- PRINCIPAL UPGRADE: Strict Focus Trap & Body Scroll Lock ---
  useEffect(() => {
    if (!isMaximized) return;

    const panel = panelRef.current;
    if (!panel) return;

    const focusableElements = panel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMaximized(false);
        maximizeButtonRef.current?.focus(); // Return focus on close
        return;
      }

      if (e.key === "Tab") {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement?.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement?.focus();
          }
        }
      }
    };

    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    // Auto-focus the first element when maximized
    firstElement?.focus();

    return () => {
      document.body.style.overflow = "unset";
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMaximized]);

  return (
    <>
      {isMaximized && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[90]"
          onClick={() => setIsMaximized(false)}
          aria-hidden="true"
        />
      )}

      <div
        ref={panelRef}
        {...(isMaximized ? { role: "dialog", "aria-modal": "true" } : {})}
        aria-label="Diagnostic Engine Panel"
        className={`bg-transparent overflow-hidden group transition-all duration-500 ${
          isMaximized
            ? "fixed inset-4 md:inset-8 z-[100] h-[calc(100vh-32px)] md:h-[calc(100vh-64px)] w-[calc(100vw-32px)] md:w-[calc(100vw-64px)] m-auto flex flex-col bg-[#0a0a0a] rounded-3xl border border-white/10 shadow-2xl"
            : "relative w-full h-full flex flex-col"
        }`}
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#111_1px,transparent_1px),linear-gradient(to_bottom,#111_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none z-0" />

        {/* --- PRINCIPAL UPGRADE: GPU-Accelerated Animation (y instead of top) --- */}
        <motion.div
          initial={{ y: "-100%" }}
          animate={{ y: "400%" }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          style={{ willChange: "transform" }}
          className="absolute left-0 right-0 h-[200px] pointer-events-none z-0 flex flex-col justify-center"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent blur-sm" />
          <div className="w-full h-[1px] bg-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.5)] relative z-10" />
        </motion.div>

        <div className="absolute inset-0 shadow-[inset_0_0_100px_rgba(0,0,0,1)] pointer-events-none z-0" />

        <button
          type="button"
          ref={maximizeButtonRef}
          onClick={() => setIsMaximized(!isMaximized)}
          aria-label={
            isMaximized
              ? "Minimize diagnostic panel"
              : "Maximize diagnostic panel"
          }
          aria-expanded={isMaximized ? "true" : "false"}
          className="absolute top-6 right-6 z-50 p-2.5 bg-black/40 border border-white/10 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all backdrop-blur-md"
        >
          {isMaximized ? (
            <Minimize2 className="w-4 h-4" />
          ) : (
            <Maximize2 className="w-4 h-4" />
          )}
        </button>

        <div className="relative z-10 p-6 md:p-8 flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex flex-col gap-3 mb-6 pb-6 border-b border-white/5 flex-shrink-0 pr-12">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-[#0a0a0a] border border-white/10 flex items-center justify-center shadow-inner relative overflow-hidden flex-shrink-0">
                <Cpu className="w-6 h-6 text-slate-300 relative z-10" />
              </div>
              <h2 className="cabinet text-2xl md:text-3xl font-bold text-white tracking-tight">
                CodeAutopsy Diagnostic Engine{" "}
                <span className="text-slate-600 font-mono text-sm ml-2 align-top">
                  v1.0
                </span>
              </h2>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-mono uppercase tracking-[0.2em] ml-16">
              [ SYSTEM STATUS:{" "}
              <span className="text-green-500 font-bold animate-pulse">
                ONLINE
              </span>{" "}
              ] <span className="hidden sm:inline text-slate-700 mx-2">•</span>{" "}
              Powered by graph traversal + AI reasoning
            </p>
          </div>

          <div className="relative z-10 flex-1 flex flex-col min-h-0 overflow-hidden pr-2">
            {error && (
              <div className="mb-6 p-4 bg-red-900/20 border border-red-500/20 backdrop-blur-md rounded-xl text-red-200 text-sm flex gap-3 items-start flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium mb-1">Diagnosis Failed</p>
                  <p className="text-xs text-red-400/70">{error}</p>
                  <button
                    type="button"
                    onClick={reset}
                    className="mt-3 text-xs text-red-400 hover:text-red-300 underline font-mono transition-colors"
                  >
                    {">"} REBOOT_DIAGNOSIS
                  </button>
                </div>
              </div>
            )}

            {/* --- PRINCIPAL UPGRADE: ARIA Live Region for Async State --- */}
            <div aria-live="polite" className="sr-only">
              {isLoading
                ? "Diagnostic engine is analyzing flow."
                : result
                  ? "Diagnosis complete."
                  : ""}
            </div>

            {isLoading && (
              <div className="mb-6 p-4 bg-[#0a0a0a]/80 border border-white/10 rounded-xl font-mono text-xs text-slate-400 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-xl backdrop-blur-md flex-shrink-0">
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 sm:items-center">
                  <span className="flex items-center gap-1.5">
                    <Search className="w-3.5 h-3.5 text-slate-500" />{" "}
                    DEPTH_SEARCH:{" "}
                    <span className="text-white font-bold ml-1">ACTIVE</span>
                  </span>
                  <span className="hidden sm:inline text-slate-700">|</span>
                  <span>NODES_SCANNED: INCREASING...</span>
                </div>
                <span className="animate-pulse text-white flex items-center gap-2">
                  <span className="w-2 h-2 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]" />{" "}
                  ANALYZING_FLOW...
                </span>
              </div>
            )}

            <div className="flex-1 flex flex-col min-h-0 w-full h-full custom-scrollbar overflow-y-auto">
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
