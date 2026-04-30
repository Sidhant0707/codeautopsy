"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Star,
  FileCode,
  Terminal,
  Cpu,
  GitMerge,
  CheckCircle2,
  Box,
  Layers,
} from "lucide-react";
import { FaGithub } from "react-icons/fa";
import RepoChat from "@/components/RepoChat";
import ShareButton from "@/components/ShareButton";
import { createClient } from "@/lib/supabase-browser";
import DebugInterface from "@/components/debug/DebugInterface";

const EXPO_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: EXPO_OUT },
  },
};

interface Analysis {
  architecture_pattern: string;
  what_it_does: string;
  execution_flow: string[];
  tech_stack: { name: string; purpose: string }[];
  key_modules: { file: string; role: string; why_it_exists: string }[];
  onboarding_guide: string[];
}

interface RepoData {
  owner: string;
  repo: string;
  description: string;
  stars: number;
  language: string;
  totalFiles: number;
  entryPoints: string[];
  mermaidDiagram: string;
  analysis: Analysis;
}

function AnalyzeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const repoUrl = searchParams.get("repo");
  const [data, setData] = useState<RepoData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<"overview" | "diagnostics">(
    "overview",
  );

  useEffect(() => {
    if (!repoUrl) return;

    async function analyze() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push(
            `/login?redirect=${encodeURIComponent(`/analyze?repo=${encodeURIComponent(repoUrl || "")}`)}`,
          );
          return;
        }

        const res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repoUrl }),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }

    analyze();
  }, [repoUrl, router]);

  // ✨ NEW: Auto-scroll fix
  const handleTabSwitch = (tab: "overview" | "diagnostics") => {
    setActiveTab(tab);
    // Smoothly scroll slightly down to center the tab content after a very brief delay to allow DOM to render
    setTimeout(() => {
      window.scrollTo({ top: 300, behavior: "smooth" });
    }, 50);
  };

  if (loading)
    return (
      <div className="min-h-screen bg-[var(--bg-deep)] flex flex-col items-center justify-center relative overflow-hidden">
        {/* Loading UI stays exactly the same... */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/[0.02] rounded-full blur-[100px] animate-pulse [animation-duration:4s]" />
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="relative z-10 w-full max-w-md p-8 glass-card rounded-2xl"
        >
          <motion.div
            variants={fadeUp}
            className="flex items-center gap-4 mb-8 border-b border-white/5 pb-6"
          >
            <div className="w-10 h-10 rounded-lg bg-[#141414] border border-white/10 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <h3 className="cabinet font-bold text-lg text-white">
                Performing Autopsy
              </h3>
              <p className="mono text-[10px] text-slate-500 tracking-widest uppercase">
                Target:{" "}
                {repoUrl?.split("/").slice(-2).join("/") || "Repository"}
              </p>
            </div>
          </motion.div>
          <div className="space-y-4">
            {[
              "Cloning repository structure...",
              "Mapping abstract syntax trees...",
              "Tracing execution flows...",
              "Synthesizing architectural patterns...",
              "Compiling autopsy report...",
            ].map((step, i) => (
              <motion.div
                key={i}
                variants={fadeUp}
                className="flex items-center gap-3"
              >
                <div className="w-4 h-4 rounded flex items-center justify-center bg-white/5 border border-white/10">
                  <div
                    className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-ping"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                </div>
                <span className="mono text-xs text-slate-400">{step}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    );

  if (error)
    return (
      <div className="min-h-screen bg-[var(--bg-deep)] flex flex-col items-center justify-center relative">
        <div className="glass-card p-8 rounded-2xl max-w-md text-center">
          <div className="w-12 h-12 mx-auto rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
            <Terminal className="w-6 h-6 text-red-400" />
          </div>
          <h2 className="cabinet text-2xl font-bold text-white mb-2">
            Autopsy Failed
          </h2>
          <p className="text-slate-400 text-sm mb-8">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="btn-gray px-6 py-3 rounded-xl text-sm font-bold text-white transition-all flex items-center justify-center gap-2 w-full"
          >
            <ArrowLeft className="w-4 h-4" />
            Return to Dashboard
          </button>
        </div>
      </div>
    );

  if (!data) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] text-[#f1f5f9] relative overflow-x-hidden font-satoshi pb-32">
      <div className="absolute top-0 left-0 w-full h-[50vh] pointer-events-none">
        <div className="absolute top-[-20%] left-[10%] w-[40%] h-[100%] bg-white/[0.015] blur-[120px] rounded-full" />
      </div>

      <div className="max-w-6xl mx-auto px-6 pt-12 relative z-10">
        <button
          onClick={() => router.push("/")}
          className="group flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors mb-12"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Search
        </button>

        <motion.div variants={staggerContainer} initial="hidden" animate="show">
          <motion.div variants={fadeUp} className="mb-12">
            <div className="flex items-start justify-between gap-8 flex-col md:flex-row">
              <div>
                <div className="flex items-center gap-4 mb-4">
                  <FaGithub className="w-8 h-8 text-white" />
                  <h1 className="cabinet text-4xl md:text-5xl font-bold tracking-tight text-white">
                    {data.owner} <span className="text-slate-600">/</span>{" "}
                    {data.repo}
                  </h1>
                </div>
                <p className="text-lg text-slate-400 max-w-2xl leading-relaxed mb-8">
                  {data.description}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="glass-card px-4 py-2 rounded-lg flex items-center gap-2">
                    <Star className="w-4 h-4 text-slate-400" />
                    <span className="mono text-xs font-bold text-white">
                      {data.stars.toLocaleString()}
                    </span>
                  </div>
                  <div className="glass-card px-4 py-2 rounded-lg flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-slate-400" />
                    <span className="mono text-xs font-bold text-white">
                      {data.totalFiles} files
                    </span>
                  </div>
                  <div className="glass-card px-4 py-2 rounded-lg flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-slate-400" />
                    <span className="mono text-xs font-bold text-white">
                      {data.language}
                    </span>
                  </div>
                  <div className="bg-white text-black px-4 py-2 rounded-lg flex items-center gap-2">
                    <Box className="w-4 h-4" />
                    <span className="mono text-xs font-bold">
                      {data.analysis.architecture_pattern}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 mt-2 md:mt-0 flex flex-col items-end gap-3 w-full md:w-auto">
                <ShareButton owner={data.owner} repo={data.repo} />

                {activeTab !== "diagnostics" && (
                  // ✨ NEW: Professional, non-AI-looking metallic pulse button
                  <button
                    onClick={() => handleTabSwitch("diagnostics")}
                    className="w-full relative group overflow-hidden rounded-lg p-[1px] bg-white/10 hover:bg-white/20 transition-colors"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                    <div className="relative flex items-center justify-center gap-2 bg-[#0a0a0a] px-6 py-3 rounded-lg transition-all shadow-[0_0_15px_rgba(255,255,255,0.05)] group-hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                      <Cpu className="w-4 h-4 text-slate-300" />
                      <span className="text-xs font-bold text-slate-100 font-mono uppercase tracking-widest">
                        Launch Engine
                      </span>
                    </div>
                  </button>
                )}
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* 
              ✨ NEW: Dynamic Column Sizing 
              If overview, span 8 and leave room for the right sidebar.
              If diagnostics, span all 12 columns for a massive workspace.
            */}
            <div
              className={`${activeTab === "overview" ? "lg:col-span-8" : "lg:col-span-12"} space-y-8 transition-all duration-500`}
            >
              <motion.div
                variants={fadeUp}
                className="flex items-center justify-center mb-8"
              >
                <div className="inline-flex items-center p-1 bg-black/40 border border-white/10 rounded-xl backdrop-blur-md shadow-2xl">
                  <button
                    onClick={() => handleTabSwitch("overview")}
                    className={`relative px-8 py-3 rounded-lg text-xs font-bold uppercase tracking-widest font-mono transition-all duration-300 ${
                      activeTab === "overview"
                        ? "text-white shadow-lg"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {activeTab === "overview" && (
                      <motion.div
                        layoutId="activeTabPill"
                        className="absolute inset-0 bg-white/10 border border-white/20 rounded-lg"
                        initial={false}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 30,
                        }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                      <FileCode className="w-4 h-4" />
                      Read_Docs
                    </span>
                  </button>

                  <button
                    onClick={() => handleTabSwitch("diagnostics")}
                    className={`relative px-8 py-3 rounded-lg text-xs font-bold uppercase tracking-widest font-mono transition-all duration-300 ${
                      activeTab === "diagnostics"
                        ? "text-slate-100 shadow-lg"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {activeTab === "diagnostics" && (
                      <motion.div
                        layoutId="activeTabPill"
                        className="absolute inset-0 bg-white/5 border border-white/10 rounded-lg"
                        initial={false}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 30,
                        }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                      <span
                        className={`w-2 h-2 rounded-full ${activeTab === "diagnostics" ? "bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.4)]" : "bg-slate-600"}`}
                      />
                      Terminal
                    </span>
                  </button>
                </div>
              </motion.div>

              {activeTab === "overview" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8"
                >
                  {/* System Purpose */}
                  <div className="glass-card p-8 rounded-3xl">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 rounded-lg bg-[#141414] border border-white/5 flex items-center justify-center">
                        <Layers className="w-4 h-4 text-slate-400" />
                      </div>
                      <h2 className="cabinet text-2xl font-bold text-white">
                        System Purpose
                      </h2>
                    </div>
                    <p className="text-slate-300 leading-relaxed text-sm md:text-base">
                      {data.analysis.what_it_does}
                    </p>
                  </div>

                  {/* Execution Flow */}
                  <div className="glass-card p-8 rounded-3xl">
                    <div className="flex items-center gap-3 mb-8">
                      <div className="w-8 h-8 rounded-lg bg-[#141414] border border-white/5 flex items-center justify-center">
                        <GitMerge className="w-4 h-4 text-slate-400" />
                      </div>
                      <h2 className="cabinet text-2xl font-bold text-white">
                        Execution Flow
                      </h2>
                    </div>
                    <div className="relative pl-4 border-l border-white/10 ml-4 space-y-8 pb-4">
                      {data.analysis.execution_flow.map((step, i) => (
                        <div key={i} className="relative pl-6">
                          <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-white border-2 border-[#0e0e0e]" />
                          <span className="mono text-[10px] text-slate-500 font-bold tracking-widest block mb-2">
                            STEP 0{i + 1}
                          </span>
                          <p className="text-sm text-slate-300 leading-relaxed">
                            {step}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Onboarding Guide */}
                  <div className="glass-card p-8 rounded-3xl">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 rounded-lg bg-[#141414] border border-white/5 flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-slate-400" />
                      </div>
                      <h2 className="cabinet text-2xl font-bold text-white">
                        Developer Onboarding
                      </h2>
                    </div>
                    <div className="space-y-4">
                      {data.analysis.onboarding_guide.map((tip, i) => (
                        <div
                          key={i}
                          className="flex gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5"
                        >
                          <div className="w-6 h-6 rounded-full bg-[#141414] border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="mono text-[10px] text-white">
                              {i + 1}
                            </span>
                          </div>
                          <p className="text-sm text-slate-300 leading-relaxed">
                            {tip}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === "diagnostics" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8"
                >
                  {data.mermaidDiagram && (
                    <DebugInterface
                      initialChart={data.mermaidDiagram}
                      repoUrl={`https://github.com/${data.owner}/${data.repo}`}
                    />
                  )}
                  <div className="max-w-4xl mx-auto">
                    <RepoChat repoContext={data} />
                  </div>
                </motion.div>
              )}
            </div>

            {/* 
              ✨ NEW: Conditional Rendering of the Sidebar
              It ONLY shows if the user is on the "overview" tab.
            */}
            {activeTab === "overview" && (
              <div className="lg:col-span-4 space-y-8 mt-12 lg:mt-0">
                <motion.section variants={fadeUp}>
                  <h2 className="mono text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 px-2">
                    Tech Stack
                  </h2>
                  <div className="space-y-3">
                    {data.analysis.tech_stack.map((tech, i) => (
                      <div
                        key={i}
                        className="glass-card hover-depth-card p-5 rounded-2xl"
                      >
                        <p className="cabinet font-bold text-white mb-2">
                          {tech.name}
                        </p>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          {tech.purpose}
                        </p>
                      </div>
                    ))}
                  </div>
                </motion.section>

                <motion.section variants={fadeUp}>
                  <h2 className="mono text-xs font-bold uppercase tracking-widest text-slate-500 mb-4 px-2">
                    Key Modules
                  </h2>
                  <div className="space-y-3">
                    {data.analysis.key_modules.map((mod, i) => (
                      <div
                        key={i}
                        className="glass-card p-5 rounded-2xl bg-[#0a0a0a]"
                      >
                        <div className="flex items-center justify-between gap-4 mb-4">
                          <code
                            className="mono text-[11px] text-slate-300 truncate"
                            title={mod.file}
                          >
                            {mod.file.split("/").pop()}
                          </code>
                          <span className="text-[9px] uppercase tracking-widest font-bold text-slate-500 bg-white/5 px-2 py-1 rounded">
                            {mod.role}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed border-l-2 border-white/10 pl-3">
                          {mod.why_it_exists}
                        </p>
                      </div>
                    ))}
                  </div>
                </motion.section>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg-deep)]" />}>
      <AnalyzeContent />
    </Suspense>
  );
}
