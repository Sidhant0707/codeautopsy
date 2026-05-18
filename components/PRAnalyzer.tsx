"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GitPullRequest,
  Search,
  AlertTriangle,
  ShieldAlert,
  Activity,
  FileCode2,
  GitMerge,
} from "lucide-react";

interface ImpactResult {
  targetFile: string;
  affectedDownstream: string[];
  riskScore: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

interface PRData {
  repository: string;
  pullRequest: string;
  modifiedFilesCount: number;
  impactReport: ImpactResult[];
}

// --- PRINCIPAL UPGRADE: Extract static mappings outside component lifecycle
const RISK_THEMES: Record<string, string> = {
  CRITICAL:
    "bg-red-500/10 text-red-500 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.15)]",
  HIGH: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  MEDIUM: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  LOW: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
};

// --- PRINCIPAL UPGRADE: Client-side Regex guardrail to protect server compute
const GITHUB_PR_REGEX =
  /^https?:\/\/(www\.)?github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+(\/.*)?$/;

export default function PRAnalyzer() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PRData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyzePR = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      const trimmedUrl = url.trim();
      if (!trimmedUrl) return;

      if (!GITHUB_PR_REGEX.test(trimmedUrl)) {
        setError(
          "Invalid format. Please enter a valid GitHub Pull Request URL.",
        );
        setData(null);
        return;
      }

      setLoading(true);
      setError(null);
      setData(null);

      try {
        const res = await fetch("/api/pr-impact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prUrl: trimmedUrl }),
        });

        const json = await res.json();

        if (!res.ok)
          throw new Error(json.error || "Failed to analyze PR via uplink.");

        setData(json);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "A critical network error occurred",
        );
      } finally {
        setLoading(false);
      }
    },
    [url],
  );

  return (
    <div className="w-full max-w-4xl mx-auto p-6 lg:p-8 bg-[#050505] border border-white/10 rounded-2xl shadow-2xl relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-blue-500/5 blur-[100px] pointer-events-none" />

      <div className="mb-8 relative z-10">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3 cabinet tracking-wide mb-2">
          <GitPullRequest className="w-6 h-6 text-blue-400" />
          PR Impact Analyzer
        </h2>
        <p className="text-slate-400 text-sm max-w-xl">
          Deploy the diagnostic engine to calculate the blast radius of proposed
          changes before merging to production.
        </p>
      </div>

      {/* --- PRINCIPAL UPGRADE: Proper Form Semantics --- */}
      <form
        onSubmit={analyzePR}
        className="flex flex-col sm:flex-row gap-3 mb-8 relative z-10"
      >
        <div className="relative flex-1 group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search
              className={`w-4 h-4 transition-colors ${loading ? "text-blue-400" : "text-slate-500 group-focus-within:text-blue-400"}`}
            />
          </div>
          <input
            type="url"
            required
            placeholder="https://github.com/owner/repo/pull/1"
            className="w-full bg-[#0a0a0a] border border-white/10 rounded-xl pl-11 pr-4 py-3.5 text-slate-200 focus:outline-none focus:border-blue-500/50 focus:bg-white/[0.02] focus:shadow-[0_0_20px_rgba(59,130,246,0.1)] transition-all font-mono text-[13px] placeholder:text-slate-600 disabled:opacity-50"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={loading}
            aria-label="GitHub Pull Request URL"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="flex items-center justify-center gap-2 bg-white text-black px-8 py-3.5 rounded-xl font-bold uppercase tracking-wider text-xs hover:bg-slate-200 disabled:opacity-50 disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex-shrink-0"
        >
          {loading ? (
            <>
              <Activity className="w-4 h-4 animate-pulse" />
              Scanning...
            </>
          ) : (
            <>
              <GitMerge className="w-4 h-4" />
              Analyze PR
            </>
          )}
        </button>
      </form>

      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="overflow-hidden mb-6"
          >
            <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl flex items-start gap-3 backdrop-blur-sm">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-red-400 uppercase tracking-wider">
                  Analysis Failed
                </h4>
                <p className="text-red-400/80 text-xs mt-1 font-mono">
                  {error}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {loading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-12 border border-white/5 bg-white/[0.02] rounded-xl backdrop-blur-sm"
          >
            <div className="relative w-16 h-16 flex items-center justify-center mb-4">
              <div className="absolute inset-0 rounded-full border-t-2 border-l-2 border-blue-500 animate-spin" />
              <div className="absolute inset-2 rounded-full border-r-2 border-b-2 border-emerald-500 animate-[spin_2s_reverse_infinite]" />
              <ShieldAlert className="w-6 h-6 text-slate-400 animate-pulse" />
            </div>
            <p className="text-sm font-mono text-slate-400 uppercase tracking-widest animate-pulse">
              Mapping Dependency Graph
            </p>
          </motion.div>
        )}

        {data && !loading && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-[#0a0a0a] border border-white/10 rounded-xl gap-4 shadow-inner">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <GitPullRequest className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold mb-0.5">
                    Target Repository
                  </p>
                  <p className="text-slate-200 font-mono text-sm font-semibold">
                    {data.repository}{" "}
                    <span className="text-slate-600 font-normal">
                      #{data.pullRequest}
                    </span>
                  </p>
                </div>
              </div>

              <div className="hidden sm:block w-px h-10 bg-white/10" />

              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                  <FileCode2 className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="sm:text-right">
                  <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold mb-0.5">
                    Files Modified
                  </p>
                  <p className="text-emerald-400 font-mono text-xl font-bold leading-none">
                    {data.modifiedFilesCount}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 pl-1">
                Blast Radius Report
              </h3>

              {data.impactReport.map((item, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.3 }}
                  className="p-4 sm:p-5 rounded-xl bg-[#0a0a0a] border border-white/5 flex flex-col sm:flex-row sm:items-start justify-between gap-4 group hover:border-white/15 transition-all shadow-lg hover:bg-white/[0.02]"
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-mono text-[13px] text-slate-200 mb-3 truncate group-hover:text-white transition-colors"
                      title={item.targetFile}
                    >
                      {item.targetFile}
                    </p>

                    {item.affectedDownstream.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mr-1 flex items-center">
                          Impacts:
                        </span>
                        {item.affectedDownstream.map((dep, i) => (
                          <span
                            key={i}
                            className="text-[10px] font-mono px-2 py-1 rounded-md bg-white/[0.03] border border-white/5 text-slate-400 truncate max-w-[200px]"
                            title={dep}
                          >
                            {dep}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-600 font-mono italic">
                        No immediate downstream dependencies detected.
                      </p>
                    )}
                  </div>

                  <div className="flex-shrink-0 flex items-center self-start">
                    <span
                      className={`px-3 py-1.5 rounded-lg border text-[10px] font-mono uppercase tracking-widest font-bold ${RISK_THEMES[item.riskScore] || RISK_THEMES.LOW}`}
                    >
                      {item.riskScore} RISK
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
