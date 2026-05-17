"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence, Variants } from "framer-motion";
import {
  ShieldAlert,
  FileCode,
  Copy,
  Check,
  Target,
  AlertCircle,
} from "lucide-react";

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

// --- PRINCIPAL UPGRADE: Staggered entry animations ---
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 400, damping: 30 },
  },
};
export default function RiskDashboard({
  coverageGaps,
  fileContents,
}: RiskDashboardProps) {
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatedTests, setGeneratedTests] = useState<Record<string, string>>(
    {},
  );
  const [copied, setCopied] = useState<string | null>(null);

  // --- PRINCIPAL UPGRADE: Inline error state instead of native alerts ---
  const [errors, setErrors] = useState<Record<string, string>>({});

  // --- PRINCIPAL UPGRADE: Memoized handlers ---
  const handleGenerateTest = useCallback(
    async (fileName: string) => {
      setGenerating(fileName);
      setErrors((prev) => ({ ...prev, [fileName]: "" })); // Clear previous errors

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

        if (!res.ok)
          throw new Error(
            "Failed to generate test. Server responded with an error.",
          );

        const data = await res.json();
        setGeneratedTests((prev) => ({ ...prev, [fileName]: data.test_code }));
      } catch (error) {
        console.error(error);
        // Beautiful inline error handling
        setErrors((prev) => ({
          ...prev,
          [fileName]: "AI Generation failed. Please try again.",
        }));
      } finally {
        setGenerating(null);
      }
    },
    [fileContents],
  );

  const handleCopy = useCallback((fileName: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(fileName);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  if (!coverageGaps || coverageGaps.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center p-12 text-center h-full"
      >
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
          <ShieldAlert className="w-8 h-8 text-emerald-400" />
        </div>
        <h3 className="text-xl font-bold text-white cabinet mb-2">
          Perimeter Secured
        </h3>
        <p className="text-sm text-slate-400 max-w-sm">
          No critical vulnerabilities found. Your high-impact files currently
          have sufficient test coverage.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="h-full flex flex-col max-w-5xl mx-auto w-full">
      <div className="mb-8 border-b border-white/5 pb-6 flex-shrink-0">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3 cabinet">
          <Target className="w-6 h-6 text-red-400" /> Risk Radar & Test AI
        </h2>
        <p className="text-sm text-slate-400 mt-2">
          Critical architectural nodes lacking unit tests. Generate
          production-ready coverage instantly.
        </p>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid gap-4 overflow-y-auto custom-scrollbar pb-12 flex-1 pr-2"
      >
        {coverageGaps.map((gap) => (
          <motion.div
            variants={itemVariants}
            key={gap.file}
            className={`group flex flex-col p-5 bg-[#0e0e0e] border rounded-xl transition-all shadow-lg ${
              errors[gap.file]
                ? "border-red-500/30"
                : "border-white/5 hover:border-white/10"
            }`}
          >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="min-w-0 flex-1">
                <h3
                  className="font-mono text-sm text-slate-200 group-hover:text-white transition-colors truncate"
                  title={gap.file}
                >
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

              <div className="flex flex-col items-end gap-2 flex-shrink-0 w-full sm:w-auto">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleGenerateTest(gap.file)}
                  disabled={generating === gap.file}
                  className="w-full sm:w-auto px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold text-slate-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed group/btn"
                >
                  {generating === gap.file ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-white rounded-full animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <FileCode className="w-3.5 h-3.5 text-amber-400 group-hover/btn:text-amber-300" />
                      Auto-Patch
                    </>
                  )}
                </motion.button>

                {/* --- PRINCIPAL UPGRADE: Beautiful inline error message --- */}
                <AnimatePresence>
                  {errors[gap.file] && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-[10px] font-mono text-red-400 flex items-center gap-1"
                    >
                      <AlertCircle className="w-3 h-3" /> {errors[gap.file]}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* --- PRINCIPAL UPGRADE: Smooth accordion terminal opening --- */}
            <AnimatePresence>
              {generatedTests[gap.file] && (
                <motion.div
                  initial={{ height: 0, opacity: 0, marginTop: 0 }}
                  animate={{ height: "auto", opacity: 1, marginTop: 20 }}
                  exit={{ height: 0, opacity: 0, marginTop: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div className="rounded-lg overflow-hidden border border-white/10 bg-[#050505] shadow-inner">
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
                    <div className="p-4 overflow-x-auto custom-scrollbar max-h-[400px]">
                      <pre className="text-[13px] text-emerald-400/90 font-mono leading-relaxed">
                        <code>{generatedTests[gap.file]}</code>
                      </pre>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
