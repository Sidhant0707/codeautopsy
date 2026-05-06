"use client";

import { useState } from "react";
import { ShieldAlert, Sparkles, Copy, Check, Target } from "lucide-react";

interface CoverageGap {
  file: string;
  fanIn: number;
  riskScore: number;
}

interface FileContent {
  path: string;
  content: string;
}

interface RiskDashboardProps {
  coverageGaps: CoverageGap[];
  fileContents: FileContent[];
}

export default function RiskDashboard({
  coverageGaps,
  fileContents,
}: RiskDashboardProps) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatedTests, setGeneratedTests] = useState<Record<string, string>>(
    {},
  );
  const [copied, setCopied] = useState<string | null>(null);

  const handleGenerateTest = async (fileName: string) => {
    setGenerating(fileName);
    try {
      const fileData = fileContents.find((f) => f.path === fileName);
      const content = fileData
        ? fileData.content
        : "// Source code not found in top payload";

      const res = await fetch("/api/generate-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, fileContent: content }),
      });

      if (!res.ok) throw new Error("Failed to generate test");

      const data = await res.json();
      setGeneratedTests((prev) => ({ ...prev, [fileName]: data.test_code }));
    } catch (error) {
      console.error(error);
      alert("AI Generation failed. Check console.");
    } finally {
      setGenerating(null);
    }
  };

  const handleCopy = (fileName: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(fileName);
    setTimeout(() => setCopied(null), 2000);
  };

  if (!coverageGaps || coverageGaps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-full">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 border border-emerald-500/20">
          <ShieldAlert className="w-8 h-8 text-emerald-400" />
        </div>
        <h3 className="text-xl font-bold text-white cabinet mb-2">
          Perimeter Secured
        </h3>
        <p className="text-sm text-slate-400 max-w-sm">
          No critical vulnerabilities found. Your high-impact files currently
          have sufficient test coverage.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col max-w-5xl mx-auto w-full">
      <div className="mb-8 border-b border-white/5 pb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3 cabinet">
          <Target className="w-6 h-6 text-red-400" /> Risk Radar & Test AI
        </h2>
        <p className="text-sm text-slate-400 mt-2">
          Critical architectural nodes lacking unit tests. Generate
          production-ready coverage instantly.
        </p>
      </div>

      <div className="grid gap-4 overflow-y-auto custom-scrollbar pb-12">
        {coverageGaps.map((gap) => (
          <div
            key={gap.file}
            className="group flex flex-col p-5 bg-[#0e0e0e] border border-white/5 rounded-xl hover:border-white/10 transition-all shadow-lg"
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="min-w-0">
                <h3 className="font-mono text-sm text-slate-200 group-hover:text-white transition-colors truncate">
                  {gap.file}
                </h3>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="px-2.5 py-1 rounded-md bg-red-500/10 border border-red-500/20 text-[10px] font-mono text-red-400 uppercase tracking-widest font-bold flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />{" "}
                    Risk: {gap.riskScore}
                  </span>
                  <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] font-mono text-slate-400 uppercase tracking-widest font-bold">
                    Imported by {gap.fanIn}
                  </span>
                </div>
              </div>

              <button
                onClick={() => handleGenerateTest(gap.file)}
                disabled={generating === gap.file}
                className="flex-shrink-0 px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold text-slate-200 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group/btn"
              >
                {generating === gap.file ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 group-hover/btn:text-amber-300" />
                    Auto-Patch
                  </>
                )}
              </button>
            </div>

            {/* Generated Code Terminal View */}
            {generatedTests[gap.file] && (
              <div className="mt-5 rounded-lg overflow-hidden border border-white/10 bg-[#050505] shadow-inner">
                <div className="flex justify-between items-center px-4 py-2.5 bg-[#111] border-b border-white/5">
                  <span className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                    </div>
                    <span className="ml-2">
                      {gap.file.replace(/\.[jt]sx?$/, ".test.ts")}
                    </span>
                  </span>
                  <button
                    onClick={() =>
                      handleCopy(gap.file, generatedTests[gap.file])
                    }
                    className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-mono text-slate-400 hover:text-white transition-colors"
                  >
                    {copied === gap.file ? (
                      <Check className="w-3.5 h-3.5 text-green-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    {copied === gap.file ? "Copied" : "Copy"}
                  </button>
                </div>
                <div className="p-4 overflow-x-auto custom-scrollbar">
                  <pre className="text-[13px] text-emerald-400/90 font-mono leading-relaxed">
                    <code>{generatedTests[gap.file]}</code>
                  </pre>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
