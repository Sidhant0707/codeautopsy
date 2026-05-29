"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import {
  GitPullRequest,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Layers,
  GitMerge,
  Users,
  ArrowLeft,
  GitBranch,
} from "lucide-react";
import { RepoData, PRAnalysisResult } from "@/lib/types/analyze";

interface PrImpactTabProps {
  data: RepoData;
  // Called once a PR has been analyzed successfully.
  // Passes the raw changed file list up to AnalyzeContent so the
  // Visualizer tab can activate pr-blast mode automatically.
  onPrAnalyzed: (changedFiles: string[]) => void;
  // Callback to switch to the visualizer tab — triggered by "View on Graph"
  onViewOnGraph: () => void;
}

export default function PrImpactTab({
  data,
  onPrAnalyzed,
  onViewOnGraph,
}: PrImpactTabProps) {
  const [prInput, setPrInput] = useState("");
  const [isAnalyzingPR, setIsAnalyzingPR] = useState(false);
  const [prResult, setPrResult] = useState<PRAnalysisResult | null>(null);
  const [prError, setPrError] = useState<string | null>(null);

  const handleAnalyzePR = useCallback(async () => {
    if (!prInput.trim()) return;
    setIsAnalyzingPR(true);
    setPrError(null);

    const extractedPrNumber = prInput.match(/\d+/)?.[0];
    if (!extractedPrNumber) {
      setPrError("Please enter a valid PR number.");
      setIsAnalyzingPR(false);
      return;
    }

    try {
      const res = await fetch("/api/analyze-pr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: data.owner,
          repo: data.repo,
          prNumber: extractedPrNumber,
        }),
      });
      const json: PRAnalysisResult = await res.json();
      if (!res.ok) throw new Error((json as unknown as { error: string }).error || "Failed to analyze PR");

      setPrResult(json);

      // Lift the changed files up to AnalyzeContent so the visualizer can
      // consume them. Guard against missing field (e.g. older cached results).
      if (json.changedFiles && json.changedFiles.length > 0) {
        onPrAnalyzed(json.changedFiles);
      }
    } catch (err: unknown) {
      setPrError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsAnalyzingPR(false);
    }
  }, [prInput, data.owner, data.repo, onPrAnalyzed]);

  return (
    <motion.div
      role="tabpanel"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.8 }}
      className="absolute inset-0 p-4 sm:p-6 flex flex-col items-center overflow-y-auto custom-scrollbar"
    >
      <div className="max-w-xl w-full glass-card p-6 sm:p-8 rounded-2xl border border-white/10 bg-[#0e0e0e]/80 text-center shadow-2xl transition-all mt-8 sm:mt-12 mb-8 flex-shrink-0">
        {!prResult ? (
          <>
            <div className="w-16 h-16 mx-auto rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
              <GitPullRequest className="w-8 h-8 text-slate-300" />
            </div>
            <h2 className="cabinet text-2xl font-bold text-white mb-3">
              PR Impact Analyzer
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed mb-8">
              Paste a Pull Request number to instantly calculate its blast
              radius, preview architectural changes, and identify breaking
              dependencies before merging.
            </p>

            <div
              className={`flex flex-col sm:flex-row items-center gap-3 bg-black/50 border rounded-xl p-2 transition-colors ${
                prError
                  ? "border-red-500/50"
                  : "border-white/10 focus-within:border-white/30"
              }`}
            >
              <div className="flex w-full sm:w-auto flex-1 items-center bg-transparent">
                <span className="text-slate-500 font-mono text-sm pl-3 pr-2 border-r border-white/10">
                  PR #
                </span>
                <input
                  type="text"
                  value={prInput}
                  onChange={(e) => setPrInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAnalyzePR()}
                  disabled={isAnalyzingPR}
                  placeholder="e.g. 142 or paste URL..."
                  className="flex-1 bg-transparent border-none outline-none text-slate-200 placeholder:text-slate-600 font-mono text-sm px-2 disabled:opacity-50 w-full"
                />
              </div>
              <button
                onClick={handleAnalyzePR}
                disabled={isAnalyzingPR || !prInput.trim()}
                className="w-full sm:w-auto px-6 py-2 bg-white/10 hover:bg-white/20 disabled:bg-white/5 disabled:text-slate-500 text-white font-bold text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isAnalyzingPR ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Parsing
                  </>
                ) : (
                  "Analyze"
                )}
              </button>
            </div>
            {prError && (
              <p className="text-red-400 text-xs font-mono mt-3 text-center">
                {prError}
              </p>
            )}
          </>
        ) : (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
            className="w-full text-left"
          >
            {/* PR header */}
            <motion.div
              variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
              className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 pb-6 border-b border-white/10 gap-4"
            >
              <div className="pr-0 md:pr-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="px-2 py-1 bg-white/10 text-white text-[10px] font-mono font-bold rounded">
                    PR #{prResult.prNumber}
                  </span>
                  <h3
                    className="text-xl font-bold text-white line-clamp-1"
                    title={prResult.title}
                  >
                    {prResult.title || "Pull Request Analysis"}
                  </h3>
                </div>
                <p className="text-sm text-slate-400 line-clamp-2">
                  {prResult.description}
                </p>
              </div>
              <div
                className={`flex-shrink-0 w-full md:w-auto px-3 py-1.5 rounded-lg border text-xs font-bold uppercase tracking-widest flex justify-center md:justify-start items-center gap-2 ${
                  prResult.riskLevel === "high"
                    ? "bg-red-500/10 border-red-500/20 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                }`}
              >
                {prResult.riskLevel === "high" ? (
                  <AlertTriangle className="w-3.5 h-3.5" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}{" "}
                {prResult.riskLevel} Risk
              </div>
            </motion.div>

            {/* View on Graph CTA — shown only when changedFiles were returned */}
            {prResult.changedFiles && prResult.changedFiles.length > 0 && (
              <motion.div
                variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
                className="mb-6"
              >
                <button
                  onClick={onViewOnGraph}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20 hover:bg-cyan-500/10 hover:border-cyan-500/40 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
                      <GitBranch className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-widest">
                        View PR Blast Radius on Graph
                      </p>
                      <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                        {prResult.changedFiles.length} changed files ·{" "}
                        switches to Blueprint Map
                      </p>
                    </div>
                  </div>
                  <div className="text-cyan-500/60 group-hover:text-cyan-400 transition-colors text-[10px] font-mono uppercase tracking-widest flex-shrink-0">
                    Open →
                  </div>
                </button>
              </motion.div>
            )}

            {/* Blast radius + architectural changes */}
            <motion.div
              variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
            >
              <div className="space-y-4">
                <h4 className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Blast Radius
                </h4>
                <div className="space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
                  {prResult.blastRadius.map((item, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/5 transition-colors"
                    >
                      <code
                        className="text-[11px] text-slate-300 font-mono mb-1.5 block truncate"
                        title={item.file}
                      >
                        {item.file}
                      </code>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {item.impact}
                      </p>
                    </div>
                  ))}
                  {prResult.blastRadius.length === 0 && (
                    <p className="text-xs text-slate-500 italic">
                      No files impacted.
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-6">
                <div className="space-y-3">
                  <h4 className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Layers className="w-4 h-4" /> Architectural Changes
                  </h4>
                  <ul className="space-y-2 p-3 rounded-lg border border-white/5 bg-[#0e0e0e]">
                    {prResult.architecturalChanges.map((change, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-xs text-slate-400"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-600 mt-1 flex-shrink-0" />
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="space-y-3">
                  <h4 className="text-xs font-mono font-bold text-amber-500/70 uppercase tracking-widest flex items-center gap-2">
                    <GitMerge className="w-4 h-4" /> Breaking Dependencies
                  </h4>
                  <div className="p-3 rounded-lg border border-amber-500/10 bg-amber-500/[0.02]">
                    <ul className="space-y-2">
                      {(Array.isArray(prResult.breakingDependencies)
                        ? prResult.breakingDependencies
                        : [prResult.breakingDependencies || "None detected"]
                      ).map((dep, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-xs text-amber-500/80"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                          {String(dep)}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Suggested reviewers */}
            {prResult.suggestedReviewers && prResult.suggestedReviewers.length > 0 && (
              <motion.div
                variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
                className="mt-8 space-y-4 text-left border-t border-white/5 pt-6"
              >
                <h4 className="text-xs font-mono font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                  <Users className="w-4 h-4" /> Context-Aware Reviewers
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {prResult.suggestedReviewers.map((reviewer, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors"
                    >
                      <Image
                        src={`https://github.com/${reviewer.username}.png`}
                        alt={reviewer.username}
                        width={40}
                        height={40}
                        unoptimized
                        className="w-10 h-10 rounded-full border border-white/10 flex-shrink-0 bg-[#141414]"
                        onError={(e) => {
                          e.currentTarget.src = "https://github.com/ghost.png";
                        }}
                      />
                      <div>
                        <span className="text-sm font-bold text-slate-200 block mb-1">
                          @{reviewer.username}
                        </span>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {reviewer.reason}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Analyze another PR */}
            <motion.div
              variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
              className="flex justify-center border-t border-white/10 pt-6 mt-8"
            >
              <button
                onClick={() => {
                  setPrResult(null);
                  setPrInput("");
                }}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-bold text-slate-300 transition-all flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Analyze Another PR
              </button>
            </motion.div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}