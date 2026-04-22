"use client";

import { useEffect } from "react";
import { useDebugAnalysis } from "@/hooks/use-debug";
import { DebugForm } from "./DebugForm";
import { DebugResults } from "./DebugResults";
import { LoadingSkeleton } from "./LoadingSkeleton";

interface CodeDoctorPanelProps {
  repoUrl: string;
  onUpdateGraph?: (newMermaidString: string) => void;
}

export function CodeDoctorPanel({ repoUrl, onUpdateGraph }: CodeDoctorPanelProps) {
  const { analyzeCrash, result, isLoading, error, reset } = useDebugAnalysis(repoUrl);

  useEffect(() => {
    if (result?.highlighted_mermaid && onUpdateGraph) {
      onUpdateGraph(result.highlighted_mermaid);
    }
  }, [result, onUpdateGraph]);

  return (
    <div className="w-full bg-black/40 backdrop-blur-2xl border border-white/10 rounded-2xl p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-indigo-500/10 blur-[100px] pointer-events-none" />

      <div className="mb-8 relative z-10">
        <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-2">
          Code Doctor
        </h2>
        <p className="text-gray-400 text-sm">
          Paste a stack trace. The engine will traverse your architecture graph to pinpoint the root cause.
        </p>
      </div>

      <div className="relative z-10">
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 backdrop-blur-md rounded-xl text-red-200 text-sm flex gap-3 items-start">
            <span className="text-lg">❌</span>
            <div className="flex-1">
              <p className="font-medium mb-1">Diagnosis Failed</p>
              <p className="text-xs text-red-300/70">{error}</p>
              <button
                onClick={reset}
                className="mt-3 text-xs text-red-400 hover:text-red-300 underline"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <LoadingSkeleton />
        ) : result ? (
          <DebugResults result={result} onReset={reset} />
        ) : (
          <DebugForm onSubmit={analyzeCrash} isLoading={isLoading} />
        )}
      </div>
    </div>
  );
}