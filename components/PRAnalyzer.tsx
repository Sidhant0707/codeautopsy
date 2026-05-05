"use client";

import React, { useState } from "react";

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

export default function PRAnalyzer() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<PRData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyzePR = async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch("/api/pr-impact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prUrl: url }),
      });

      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Failed to analyze PR");

      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (score: string) => {
    switch (score) {
      case "CRITICAL":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "HIGH":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "MEDIUM":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      default:
        return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-[#0a0a0a] border border-white/10 rounded-2xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-200 mb-2">
          PR Impact Analyzer
        </h2>
        <p className="text-slate-400 text-sm">
          Paste a GitHub Pull Request URL to calculate the blast radius of
          proposed changes.
        </p>
      </div>

      {}
      <div className="flex gap-3 mb-8">
        <input
          type="text"
          placeholder="https://github.com/owner/repo/pull/1"
          className="flex-1 bg-[#141414] border border-white/10 rounded-lg px-4 py-3 text-slate-200 focus:outline-none focus:border-blue-500/50 transition-colors font-mono text-sm"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && analyzePR()}
        />
        <button
          onClick={analyzePR}
          disabled={loading || !url}
          className="bg-slate-200 text-slate-900 px-6 py-3 rounded-lg font-semibold hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? "Analyzing..." : "Scan PR"}
        </button>
      </div>

      {}
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm mb-6">
          {error}
        </div>
      )}

      {}
      {data && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div>
              <p className="text-slate-400 text-sm">Repository</p>
              <p className="text-slate-200 font-mono">
                {data.repository}{" "}
                <span className="text-slate-500">#{data.pullRequest}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-slate-400 text-sm">Files Modified</p>
              <p className="text-slate-200 font-mono text-xl">
                {data.modifiedFilesCount}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {data.impactReport.map((item, idx) => (
              <div
                key={idx}
                className="p-4 rounded-lg bg-[#141414] border border-white/5 flex items-start justify-between gap-4 group hover:border-white/10 transition-colors"
              >
                <div>
                  <p className="font-mono text-sm text-slate-300 mb-2">
                    {item.targetFile}
                  </p>
                  {item.affectedDownstream.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {item.affectedDownstream.map((dep, i) => (
                        <span
                          key={i}
                          className="text-[10px] font-mono px-2 py-1 rounded bg-white/5 text-slate-400"
                        >
                          {dep}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600 font-mono">
                      No downstream dependencies detected.
                    </p>
                  )}
                </div>
                <div
                  className={`px-3 py-1 rounded border text-xs font-bold tracking-wider ${getRiskColor(item.riskScore)}`}
                >
                  {item.riskScore}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
