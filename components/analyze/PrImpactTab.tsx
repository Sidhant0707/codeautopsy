// components/analyze/PrImpactTab.tsx

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
  Lock,
  Zap,
  ShieldAlert,
  UserCheck,
  Share2,
} from "lucide-react";
import { RepoData, PRAnalysisResult } from "@/lib/types/analyze";

interface PrImpactTabProps {
  data: RepoData;
  isPro: boolean;
  onPrAnalyzed: (changedFiles: string[]) => void;
  onViewOnGraph: () => void;
}

// ── Pro Gate ──────────────────────────────────────────────────────────────────

function ProGate({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="w-full mt-4"
    >
      <div className="relative rounded-2xl overflow-hidden border border-white/[0.06]">
        {/* Ghost preview */}
        <div className="p-5 blur-sm pointer-events-none select-none opacity-35">
          <div className="flex items-center justify-between mb-4">
            <div className="h-3.5 w-28 bg-white/8 rounded" />
            <div className="h-5 w-18 bg-red-500/18 rounded-lg" />
          </div>
          <div className="grid grid-cols-2 gap-2.5 mb-3.5">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-16 bg-white/[0.04] rounded-xl border border-white/[0.04]"
              />
            ))}
          </div>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-12 bg-white/[0.035] rounded-lg border border-white/[0.04]"
              />
            ))}
          </div>
        </div>

        {/* Overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-[18px] bg-[#0a0a0a]/82 backdrop-blur-[2px] rounded-2xl px-6 py-8">
          {/* Lock icon */}
          <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
            <Lock className="w-5 h-5 text-slate-400" />
          </div>

          {/* Copy */}
          <div className="text-center">
            <p className="text-[13px] font-bold font-mono text-slate-100 tracking-tight mb-1.5">
              PR Impact requires Pro
            </p>
            <p className="text-[10px] font-mono text-slate-500 leading-relaxed max-w-[240px]">
              Upgrade to unlock full blast radius analysis, breaking dependency
              detection, and context-aware reviewer suggestions.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-1.5 justify-center">
            {[
              {
                label: "Blast Radius",
                icon: Zap,
                style: "bg-red-500/8 border-red-500/20 text-red-400",
              },
              {
                label: "Breaking Deps",
                icon: ShieldAlert,
                style: "bg-amber-500/8 border-amber-500/20 text-amber-400",
              },
              {
                label: "Reviewer Suggestions",
                icon: UserCheck,
                style: "bg-blue-500/8 border-blue-500/20 text-blue-400",
              },
              {
                label: "Graph Highlight",
                icon: Share2,
                style: "bg-cyan-500/8 border-cyan-500/20 text-cyan-400",
              },
            ].map(({ label, icon: Icon, style }) => (
              <span
                key={label}
                className={`flex items-center gap-1.5 text-[9px] font-mono font-black px-2.5 py-1 rounded-full border uppercase tracking-widest ${style}`}
              >
                <Icon className="w-2.5 h-2.5 flex-shrink-0" />
                {label}
              </span>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={onUpgrade}
            className="group flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-[#0a0a0a] text-[10px] font-black font-mono uppercase tracking-widest hover:bg-slate-200 transition-colors"
          >
            Upgrade to Pro
            <svg
              className="w-3 h-3 transition-transform group-hover:translate-x-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>

          <p className="text-[9px] font-mono text-slate-600">
            Already on Pro?{" "}
            <button
              onClick={() => window.open("/login", "_blank")}
              className="text-slate-500 underline underline-offset-2 hover:text-slate-400 transition-colors"
            >
              Sign in to unlock
            </button>
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Tab ──────────────────────────────────────────────────────────────────

export default function PrImpactTab({
  data,
  isPro,
  onPrAnalyzed,
  onViewOnGraph,
}: PrImpactTabProps) {
  const [prInput, setPrInput] = useState("");
  const [isAnalyzingPR, setIsAnalyzingPR] = useState(false);
  const [prResult, setPrResult] = useState<PRAnalysisResult | null>(null);
  const [prError, setPrError] = useState<string | null>(null);
  const [showGate, setShowGate] = useState(false);

  const handleAnalyzePR = useCallback(async () => {
    if (!prInput.trim()) return;

    if (!isPro) {
      setShowGate(true);
      return;
    }

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
      if (!res.ok)
        throw new Error(
          (json as unknown as { error: string }).error ||
            "Failed to analyze PR",
        );

      setPrResult(json);
      if (json.changedFiles && json.changedFiles.length > 0) {
        onPrAnalyzed(json.changedFiles);
      }
    } catch (err: unknown) {
      setPrError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsAnalyzingPR(false);
    }
  }, [prInput, isPro, data.owner, data.repo, onPrAnalyzed]);

  const handleUpgrade = useCallback(() => {
    window.open("/pricing", "_blank");
  }, []);

  return (
    <motion.div
      role="tabpanel"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.8 }}
      className="absolute inset-0 p-4 sm:p-6 flex flex-col items-center overflow-y-auto [&::-webkit-scrollbar]:w-px [&::-webkit-scrollbar-thumb]:bg-white/10"
    >
      <div className="max-w-xl w-full mt-8 sm:mt-12 mb-8 flex-shrink-0">
        {!prResult ? (
          <div className="p-6 sm:p-8 rounded-2xl border border-white/10 bg-[#0e0e0e]/80 shadow-2xl text-center">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6 text-left">
              <div className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/8 flex items-center justify-center flex-shrink-0">
                <GitPullRequest className="w-4.5 h-4.5 text-slate-400" />
              </div>
              <div>
                <p className="text-[11px] font-mono font-bold text-slate-200 uppercase tracking-widest">
                  PR Impact Analyzer
                </p>
                <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                  Blast radius · Breaking deps · Reviewer suggestions
                </p>
              </div>
            </div>

            {/* Input */}
            <div
              className={`flex items-center gap-0 bg-black/50 border rounded-xl overflow-hidden transition-colors ${
                prError
                  ? "border-red-500/50"
                  : "border-white/10 focus-within:border-white/25"
              }`}
            >
              <span className="text-slate-500 font-mono text-[11px] px-4 py-3 border-r border-white/8 flex-shrink-0">
                PR #
              </span>
              <input
                type="text"
                value={prInput}
                onChange={(e) => setPrInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAnalyzePR()}
                disabled={isAnalyzingPR}
                placeholder="e.g. 142 or paste URL..."
                className="flex-1 bg-transparent border-none outline-none text-slate-200 placeholder:text-slate-600 font-mono text-[11px] px-3 py-3 disabled:opacity-50 min-w-0"
              />
              <button
                onClick={handleAnalyzePR}
                disabled={isAnalyzingPR || !prInput.trim()}
                className="px-5 py-3 bg-white/8 hover:bg-white/14 disabled:bg-white/4 disabled:text-slate-600 text-slate-200 font-mono font-bold text-[10px] uppercase tracking-widest transition-colors flex-shrink-0 flex items-center gap-2 border-l border-white/8"
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
              <p className="text-red-400 text-[10px] font-mono mt-3 text-left">
                {prError}
              </p>
            )}

            {/* Pro gate (shown when non-pro user hits Analyze) */}
            {showGate && !isPro && <ProGate onUpgrade={handleUpgrade} />}
          </div>
        ) : (
          /* ── Result view ───────────────────────────────────────────────── */
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
            className="p-6 sm:p-8 rounded-2xl border border-white/10 bg-[#0e0e0e]/80 shadow-2xl"
          >
            {/* PR header */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0 },
              }}
              className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 pb-6 border-b border-white/8 gap-4"
            >
              <div className="flex-1 min-w-0 pr-0 md:pr-4">
                <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                  <span className="px-2 py-0.5 bg-white/8 text-slate-300 text-[9px] font-mono font-bold rounded border border-white/8 uppercase tracking-widest flex-shrink-0">
                    PR #{prResult.prNumber}
                  </span>
                  <h3
                    className="text-base font-bold text-white truncate"
                    title={prResult.title}
                  >
                    {prResult.title || "Pull Request Analysis"}
                  </h3>
                </div>
                <p className="text-[11px] font-mono text-slate-500 line-clamp-2 leading-relaxed">
                  {prResult.description}
                </p>
              </div>
              <div
                className={`flex-shrink-0 w-full md:w-auto px-3 py-1.5 rounded-lg border text-[10px] font-mono font-bold uppercase tracking-widest flex justify-center md:justify-start items-center gap-2 ${
                  prResult.riskLevel === "high"
                    ? "bg-red-500/10 border-red-500/20 text-red-400"
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                }`}
              >
                {prResult.riskLevel === "high" ? (
                  <AlertTriangle className="w-3.5 h-3.5" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                {prResult.riskLevel} Risk
              </div>
            </motion.div>

            {/* View on graph CTA */}
            {prResult.changedFiles && prResult.changedFiles.length > 0 && (
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  visible: { opacity: 1, y: 0 },
                }}
                className="mb-6"
              >
                <button
                  onClick={onViewOnGraph}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20 hover:bg-cyan-500/10 hover:border-cyan-500/35 transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
                      <GitBranch className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-mono font-bold text-cyan-300 uppercase tracking-widest">
                        View PR Blast Radius on Graph
                      </p>
                      <p className="text-[9px] font-mono text-slate-600 mt-0.5">
                        {prResult.changedFiles.length} changed files · switches
                        to Blueprint Map
                      </p>
                    </div>
                  </div>
                  <span className="text-cyan-600 group-hover:text-cyan-400 transition-colors text-[9px] font-mono uppercase tracking-widest flex-shrink-0">
                    Open →
                  </span>
                </button>
              </motion.div>
            )}

            {/* Blast radius + architectural changes */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0 },
              }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6"
            >
              {/* Blast radius */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5" /> Blast Radius
                </h4>
                <div className="space-y-1.5 max-h-[240px] overflow-y-auto [&::-webkit-scrollbar]:w-px [&::-webkit-scrollbar-thumb]:bg-white/10] pr-1">
                  {prResult.blastRadius.map((item, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                    >
                      <code
                        className="text-[10px] text-slate-300 font-mono mb-1 block truncate"
                        title={item.file}
                      >
                        {item.file}
                      </code>
                      <p className="text-[10px] font-mono text-slate-500 leading-relaxed">
                        {item.impact}
                      </p>
                    </div>
                  ))}
                  {prResult.blastRadius.length === 0 && (
                    <p className="text-[10px] font-mono text-slate-600 italic px-1">
                      No files impacted.
                    </p>
                  )}
                </div>
              </div>

              {/* Architectural changes + breaking deps */}
              <div className="space-y-5">
                <div className="space-y-2">
                  <h4 className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5" /> Architectural Changes
                  </h4>
                  <ul className="space-y-1.5 p-3 rounded-lg border border-white/5 bg-[#0a0a0a]">
                    {prResult.architecturalChanges.map((change, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-[10px] font-mono text-slate-400"
                      >
                        <div className="w-1 h-1 rounded-full bg-slate-600 mt-1.5 flex-shrink-0" />
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="text-[10px] font-mono font-bold text-amber-500/70 uppercase tracking-widest flex items-center gap-2">
                    <GitMerge className="w-3.5 h-3.5" /> Breaking Dependencies
                  </h4>
                  <div className="p-3 rounded-lg border border-amber-500/10 bg-amber-500/[0.02]">
                    <ul className="space-y-1.5">
                      {(Array.isArray(prResult.breakingDependencies)
                        ? prResult.breakingDependencies
                        : [prResult.breakingDependencies || "None detected"]
                      ).map((dep, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-[10px] font-mono text-amber-500/80"
                        >
                          <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                          {String(dep)}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Suggested reviewers */}
            {prResult.suggestedReviewers &&
              prResult.suggestedReviewers.length > 0 && (
                <motion.div
                  variants={{
                    hidden: { opacity: 0, y: 10 },
                    visible: { opacity: 1, y: 0 },
                  }}
                  className="space-y-3 border-t border-white/5 pt-6 mb-6"
                >
                  <h4 className="text-[10px] font-mono font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                    <Users className="w-3.5 h-3.5" /> Context-Aware Reviewers
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {prResult.suggestedReviewers.map((reviewer, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors"
                      >
                        <Image
                          src={`https://github.com/${reviewer.username}.png`}
                          alt={reviewer.username}
                          width={36}
                          height={36}
                          unoptimized
                          className="w-9 h-9 rounded-full border border-white/10 flex-shrink-0 bg-[#141414]"
                          onError={(e) => {
                            e.currentTarget.src =
                              "https://github.com/ghost.png";
                          }}
                        />
                        <div className="min-w-0">
                          <span className="text-[11px] font-mono font-bold text-slate-200 block mb-0.5">
                            @{reviewer.username}
                          </span>
                          <p className="text-[10px] font-mono text-slate-500 leading-relaxed">
                            {reviewer.reason}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

            {/* Back button */}
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0 },
              }}
              className="flex justify-center border-t border-white/8 pt-6"
            >
              <button
                onClick={() => {
                  setPrResult(null);
                  setPrInput("");
                }}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/8 border border-white/8 text-[11px] font-mono font-bold text-slate-300 transition-all flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Analyze Another PR
              </button>
            </motion.div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
