"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  FileCode,
  Terminal,
  Cpu,
  GitMerge,
  CheckCircle2,
  Layers,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  MessageSquare,
  X,
  LayoutGrid,
} from "lucide-react";
import { FaGithub } from "react-icons/fa";
import RepoChat from "@/components/RepoChat";
import ShareButton from "@/components/ShareButton";
import { createClient } from "@/lib/supabase-browser";
import DebugInterface from "@/components/debug/DebugInterface";
import ArchitectureMap from "@/components/ArchitectureMap";

const EXPO_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EXPO_OUT } },
};

interface Analysis {
  architecture_pattern: string;
  what_it_does: string;
  execution_flow: string[];
  tech_stack: { name: string; purpose: string }[];
  key_modules: { file: string; role: string; why_it_exists: string }[];
  onboarding_guide: string[];
  blast_radius: {
    file: string;
    dependents: number;
    warning: string;
    safe_refactor_steps: string[];
  }[];
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
  dependencyGraph?: Record<string, string[]>;
}

function AnalyzeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const repoUrl = searchParams.get("repo");
  const source = searchParams.get("source");

  const [data, setData] = useState<RepoData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGitHubAuthModal, setShowGitHubAuthModal] = useState(false);

  const [activeTab, setActiveTab] = useState<
    "overview" | "visualizer" | "doctor"
  >("overview");
  const [isChatOpen, setIsChatOpen] = useState(false);

  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [hideFeedback, setHideFeedback] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);

  useEffect(() => {
    if (source === "local") {
      const localData = sessionStorage.getItem("localAnalysisResult");
      if (localData) {
        setData(JSON.parse(localData));
        setLoading(false);
        return;
      } else {
        setError(
          "Local analysis data expired or lost. Please return to home and upload again.",
        );
        setLoading(false);
        return;
      }
    }

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

        if (json.error === "REQUIRE_GITHUB_AUTH") {
          setShowGitHubAuthModal(true);
          setLoading(false);
          return;
        }

        if (json.error) throw new Error(json.error);
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    analyze();
  }, [repoUrl, source, router]);

  const handleGitHubLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        scopes: "repo",
        redirectTo: `${window.location.origin}/analyze?repo=${encodeURIComponent(repoUrl || "")}`,
      },
    });
  };

  const handleFeedback = async (
    isHelpful: boolean,
    exitAfter: boolean = false,
  ) => {
    setFeedbackSubmitted(true);
    if (exitAfter) setShowExitModal(false);

    if (!exitAfter) {
      setTimeout(() => {
        setHideFeedback(true);
      }, 2000);
    }

    try {
      const supabase = createClient();
      await supabase.from("debug_feedback").insert([
        {
          debug_id: data?.repo || repoUrl || "local-upload",
          is_helpful: isHelpful,
        },
      ]);
    } catch (err) {
      console.error(err);
    }

    if (exitAfter) router.push("/");
  };

  const handleBackNavigation = () => {
    if (!feedbackSubmitted) {
      setShowExitModal(true);
    } else {
      router.push("/");
    }
  };

  if (loading)
    return (
      <div className="h-screen w-screen bg-[#0a0a0a] flex flex-col items-center justify-center relative overflow-hidden text-slate-200 font-satoshi">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-white/[0.01] rounded-full blur-[80px] animate-pulse" />
        <div className="relative z-10 glass-card p-8 rounded-2xl border border-white/5 max-w-sm w-full">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/5">
            <div className="w-10 h-10 rounded-xl bg-[#141414] border border-white/10 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-slate-400" />
            </div>
            <div>
              <h3 className="cabinet font-bold text-lg text-white">
                Performing Autopsy
              </h3>
              <p className="mono text-[10px] text-slate-500 tracking-widest uppercase truncate max-w-[200px]">
                {source === "local"
                  ? "Local.zip Upload"
                  : repoUrl?.split("/").slice(-2).join("/") || "Repository"}
              </p>
            </div>
          </div>
          <div className="space-y-4">
            {[
              "Cloning repository...",
              "Mapping syntax trees...",
              "Tracing execution flows...",
              "Compiling report...",
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded flex items-center justify-center bg-white/5 border border-white/10">
                  <div
                    className="w-1 h-1 rounded-full bg-slate-400 animate-ping"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                </div>
                <span className="mono text-xs text-slate-400">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );

  if (error)
    return (
      <div className="h-screen w-screen bg-[#0a0a0a] flex flex-col items-center justify-center font-satoshi">
        <div className="glass-card p-8 rounded-2xl max-w-md text-center border border-red-500/10">
          <div className="w-12 h-12 mx-auto rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
            <Terminal className="w-6 h-6 text-red-400" />
          </div>
          <h2 className="cabinet text-2xl font-bold text-white mb-2">
            Autopsy Failed
          </h2>
          <p className="text-slate-400 text-sm mb-8">{error}</p>
          <button
            onClick={() => router.push("/")}
            className="w-full px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-bold text-white transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Dashboard
          </button>
        </div>
      </div>
    );

  if (!data) return null;

  if (showGitHubAuthModal) {
    return (
      <div className="h-screen w-screen bg-[#0a0a0a] flex flex-col items-center justify-center relative font-satoshi">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 glass-card p-8 rounded-2xl max-w-md mx-4 border-2 border-white/10 bg-[#0e0e0e]"
        >
          <div className="w-16 h-16 mx-auto rounded-2xl bg-white/5 border border-white/20 flex items-center justify-center mb-6">
            <FaGithub className="w-8 h-8 text-white" />
          </div>
          <h2 className="cabinet text-2xl font-bold text-white mb-3 text-center">
            Private Repository
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-8 text-center">
            To analyze private code, you need to authenticate with GitHub.
          </p>
          <div className="space-y-3">
            <button
              onClick={handleGitHubLogin}
              className="w-full bg-white text-black px-6 py-4 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all flex items-center justify-center gap-3"
            >
              <FaGithub className="w-5 h-5" /> Connect GitHub Account
            </button>
            <button
              onClick={() => router.push("/")}
              className="w-full px-6 py-4 rounded-xl border border-white/10 font-bold text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Home
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-[#0a0a0a] text-slate-200 overflow-hidden flex flex-col font-satoshi">
      <header className="h-16 flex-shrink-0 border-b border-white/5 bg-[#0e0e0e] flex items-center justify-between px-4 lg:px-6 z-20">
        <div className="flex items-center gap-6">
          <button
            onClick={handleBackNavigation}
            title="Go back"
            className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div className="flex items-center gap-3">
            <FaGithub className="w-5 h-5 text-slate-400 hidden sm:block" />
            <h1 className="cabinet text-lg md:text-xl font-bold text-slate-100 flex items-center gap-2">
              {source === "local" ? (
                "Local Codebase"
              ) : (
                <>
                  <span className="text-slate-500 font-medium">
                    {data.owner}
                  </span>
                  <span className="text-slate-600">/</span>
                  {data.repo}
                </>
              )}
            </h1>
            <div className="hidden md:flex items-center gap-2 ml-4 px-3 py-1 rounded-full bg-white/[0.02] border border-white/5">
              <Terminal className="w-3 h-3 text-slate-500" />
              <span className="mono text-[10px] text-slate-400 font-bold uppercase">
                {data.language}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          
          {/* ✨ NEW DASHBOARD BUTTON ADDED HERE ✨ */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all font-mono text-[10px] uppercase tracking-widest font-bold"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>

          <AnimatePresence mode="wait">
            {!hideFeedback && (
              <motion.div
                key={feedbackSubmitted ? "thanks" : "form"}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5, filter: "blur(4px)" }}
                className="hidden sm:flex items-center mr-2"
              >
                {!feedbackSubmitted ? (
                  <div className="flex items-center gap-1 bg-white/[0.02] border border-white/5 rounded-lg p-1">
                    <span className="text-[10px] uppercase font-mono text-slate-500 px-2 font-bold">
                      Helpful?
                    </span>
                    <button
                      type="button"
                      aria-label="Mark feedback as helpful"
                      title="Mark feedback as helpful"
                      onClick={() => handleFeedback(true)}
                      className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-green-400 transition-colors"
                    >
                      <ThumbsUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Mark feedback as not helpful"
                      title="Mark feedback as not helpful"
                      onClick={() => handleFeedback(false)}
                      className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <ThumbsDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-[10px] uppercase font-mono text-green-400 font-bold">
                      Thanks!
                    </span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg mr-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500/50" />
            <span className="text-[10px] uppercase font-mono text-green-500/50 font-bold">
              Feedback Sent
            </span>
          </div>

          {source !== "local" && (
            <ShareButton owner={data.owner} repo={data.repo} />
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a]">
          <div className="h-12 flex-shrink-0 border-b border-white/5 flex items-center px-4 gap-1 bg-[#0a0a0a]/50">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-4 py-2 rounded-md text-[11px] font-bold uppercase tracking-widest font-mono transition-colors flex items-center gap-2 ${activeTab === "overview" ? "bg-white/10 text-white" : "text-slate-500 hover:bg-white/5 hover:text-slate-300"}`}
            >
              <FileCode className="w-3.5 h-3.5" /> Read_Docs
            </button>
            <button
              onClick={() => setActiveTab("visualizer")}
              className={`px-4 py-2 rounded-md text-[11px] font-bold uppercase tracking-widest font-mono transition-colors flex items-center gap-2 ${activeTab === "visualizer" ? "bg-white/10 text-white" : "text-slate-500 hover:bg-white/5 hover:text-slate-300"}`}
            >
              <Layers className="w-3.5 h-3.5" /> Blueprint_Map
            </button>
            <button
              onClick={() => setActiveTab("doctor")}
              className={`px-4 py-2 rounded-md text-[11px] font-bold uppercase tracking-widest font-mono transition-colors flex items-center gap-2 ${activeTab === "doctor" ? "bg-white/10 text-white" : "text-slate-500 hover:bg-white/5 hover:text-slate-300"}`}
            >
              <Terminal className="w-3.5 h-3.5" /> Diagnostic_Engine
            </button>
          </div>

          <div className="flex-1 overflow-hidden relative">
            {activeTab === "overview" && (
              <div className="absolute inset-0 overflow-y-auto p-6 custom-scrollbar">
                <motion.div
                  initial="hidden"
                  animate="show"
                  variants={fadeUp}
                  className="max-w-5xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-6 pb-12"
                >
                  <div className="xl:col-span-8 space-y-6">
                    <div className="glass-card p-6 rounded-2xl border border-white/5 bg-[#0e0e0e]">
                      <h2 className="cabinet text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-slate-500" /> System
                        Purpose
                      </h2>
                      <p className="text-slate-400 leading-relaxed text-sm">
                        {data.analysis.what_it_does}
                      </p>
                    </div>

                    <div className="glass-card p-6 rounded-2xl border border-white/5 bg-[#0e0e0e]">
                      <h2 className="cabinet text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <GitMerge className="w-4 h-4 text-slate-500" />{" "}
                        Execution Flow
                      </h2>
                      <div className="relative pl-4 border-l border-white/10 ml-2 space-y-6 pb-2">
                        {data.analysis.execution_flow.map((step, i) => (
                          <div key={i} className="relative pl-6">
                            <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-slate-400 border-2 border-[#0e0e0e]" />
                            <span className="mono text-[10px] text-slate-500 font-bold tracking-widest block mb-1 uppercase">
                              Step 0{i + 1}
                            </span>
                            <p className="text-sm text-slate-400 leading-relaxed">
                              {step}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="glass-card p-6 rounded-2xl border border-white/5 bg-[#0e0e0e]">
                      <h2 className="cabinet text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-slate-500" />{" "}
                        Developer Onboarding
                      </h2>
                      <div className="space-y-3">
                        {data.analysis.onboarding_guide.map((tip, i) => (
                          <div
                            key={i}
                            className="flex gap-4 p-4 rounded-xl bg-black/20 border border-white/5"
                          >
                            <div className="w-5 h-5 rounded-full bg-[#141414] border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="mono text-[9px] text-slate-400 font-bold">
                                {i + 1}
                              </span>
                            </div>
                            <p className="text-sm text-slate-400 leading-relaxed">
                              {tip}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="xl:col-span-4 space-y-6">
                    {data.analysis.blast_radius &&
                      data.analysis.blast_radius.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 mb-2 px-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500/80" />
                            <h2 className="mono text-[10px] font-bold uppercase tracking-widest text-amber-500/80">
                              Blast Radius
                            </h2>
                          </div>
                          {data.analysis.blast_radius.map((risk, i) => (
                            <div
                              key={i}
                              className="glass-card p-4 rounded-xl border border-amber-500/10 bg-amber-500/[0.02]"
                            >
                              <code
                                className="mono text-[11px] text-amber-400/80 mb-2 block truncate"
                                title={risk.file}
                              >
                                {risk.file.split("/").pop()}
                              </code>
                              <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">
                                {risk.warning}
                              </p>
                              <div className="flex items-center gap-1.5 text-[9px] text-amber-500/60 font-mono uppercase">
                                <Layers className="w-3 h-3" /> {risk.dependents}{" "}
                                Dependent File(s)
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                    <div className="space-y-3">
                      <h2 className="mono text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 px-1">
                        Key Modules
                      </h2>
                      {data.analysis.key_modules.map((mod, i) => (
                        <div
                          key={i}
                          className="glass-card p-4 rounded-xl bg-[#0e0e0e] border border-white/5"
                        >
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <code
                              className="mono text-[11px] text-slate-300 truncate"
                              title={mod.file}
                            >
                              {mod.file.split("/").pop()}
                            </code>
                            <span className="text-[8px] uppercase tracking-widest font-bold text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">
                              {mod.role}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-relaxed border-l-2 border-white/10 pl-2">
                            {mod.why_it_exists}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </div>
            )}

            {activeTab === "visualizer" && (
              <div className="absolute inset-0 p-4">
                {data.dependencyGraph &&
                Object.keys(data.dependencyGraph).length > 0 ? (
                  <div className="w-full h-full rounded-2xl border border-white/5 overflow-hidden">
                    <ArchitectureMap
                      dependencyGraph={data.dependencyGraph}
                      entryPoints={data.entryPoints}
                    />
                  </div>
                ) : (
                  <div className="w-full h-full rounded-2xl border border-white/5 bg-[#0e0e0e] flex flex-col items-center justify-center">
                    <Layers className="w-10 h-10 text-slate-600 mb-4" />
                    <p className="text-slate-500 font-mono text-xs">
                      No blueprint data parsed for this codebase.
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "doctor" && (
              <div className="absolute inset-0 overflow-hidden p-4">
                <div className="flex flex-col gap-4 h-full">
                  {data.mermaidDiagram ? (
                    <>
                      <div className="w-full flex-1 min-h-0 rounded-2xl border border-white/5 overflow-hidden bg-[#0e0e0e] relative">
                        <DebugInterface
                          repoUrl={
                            source === "local"
                              ? "Local.zip Codebase"
                              : `https://github.com/${data.owner}/${data.repo}`
                          }
                        />
                      </div>
                      <button
                        onClick={() => setIsChatOpen(true)}
                        className="w-full flex-shrink-0 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center justify-center gap-3 group shadow-lg"
                      >
                        <MessageSquare className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
                        <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">
                          Discuss this diagnosis in Copilot &rarr;
                        </span>
                      </button>
                    </>
                  ) : (
                    <div className="w-full h-full rounded-2xl border border-white/5 bg-[#0e0e0e] flex flex-col items-center justify-center min-h-[600px]">
                      <Terminal className="w-10 h-10 text-slate-600 mb-4" />
                      <p className="text-slate-500 font-mono text-xs">
                        Diagnostic core offline.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <AnimatePresence>
          {!isChatOpen && (
            <motion.button
              type="button"
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              onClick={() => setIsChatOpen(true)}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-40 flex items-center gap-3 bg-[#141414]/90 backdrop-blur-md border border-white/10 border-r-0 px-4 py-4 rounded-l-2xl shadow-[-10px_0_30px_rgba(0,0,0,0.5)] hover:bg-[#1a1a1a] hover:pr-6 transition-all group"
            >
              <div className="relative">
                <MessageSquare className="w-5 h-5 text-slate-300 group-hover:text-white transition-colors" />
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              </div>
              <div className="flex flex-col text-left hidden sm:flex">
                <span className="font-bold text-xs text-white">Need Help?</span>
                <span className="font-mono text-[9px] uppercase tracking-widest text-slate-500">
                  Ask Copilot
                </span>
              </div>
            </motion.button>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isChatOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 420, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: EXPO_OUT }}
              className="h-full flex-shrink-0 border-l border-white/5 bg-[#0a0a0a] flex flex-col z-10 shadow-[-20px_0_40px_rgba(0,0,0,0.5)]"
            >
              <div className="h-12 flex-shrink-0 border-b border-white/5 flex items-center justify-between px-4 bg-[#0e0e0e]">
                <div className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-slate-400" />
                  <h3 className="text-[11px] font-bold text-slate-300 uppercase tracking-widest font-mono">
                    Autopsy Copilot
                  </h3>
                </div>
                <button
                  onClick={() => setIsChatOpen(false)}
                  className="p-1.5 rounded-md hover:bg-white/10 text-slate-500 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 min-h-0 bg-transparent">
                <RepoChat
                  repoContext={
                    data as unknown as {
                      repo?: string;
                      [key: string]: string | undefined;
                    }
                  }
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showExitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => router.push("/")}
            />
            <motion.div
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
                    onClick={() => handleFeedback(true, true)}
                    className="flex-1 py-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-colors text-sm font-bold text-slate-300 flex items-center justify-center gap-2"
                  >
                    <ThumbsUp className="w-4 h-4" /> Yes
                  </button>
                  <button
                    onClick={() => handleFeedback(false, true)}
                    className="flex-1 py-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-colors text-sm font-bold text-slate-300 flex items-center justify-center gap-2"
                  >
                    <ThumbsDown className="w-4 h-4" /> No
                  </button>
                </div>
                <button
                  onClick={() => router.push("/")}
                  className="w-full py-2 mt-2 text-xs font-mono tracking-widest uppercase text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Skip
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen bg-[#0a0a0a] flex items-center justify-center text-slate-500 font-mono text-sm tracking-widest uppercase">
          INITIALIZING...
        </div>
      }
    >
      <AnalyzeContent />
    </Suspense>
  );
}