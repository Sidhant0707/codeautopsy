"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { BadgeEmbed } from "@/components/BadgeEmbed";
import ExportButton from "@/components/ExportButton";
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
  Activity,
  GitPullRequest,
  Users,
} from "lucide-react";
import { FaGithub } from "react-icons/fa";
import RepoChat from "@/components/RepoChat";
import ShareButton from "@/components/ShareButton";
import { createClient } from "@/lib/supabase-browser";
import DebugInterface from "@/components/debug/DebugInterface";
import ArchitectureMap from "@/components/ArchitectureMap";
import TreemapVisualizer from "@/components/TreemapVisualizer";
import DirectoryTreeVisualizer from "@/components/DirectoryTreeVisualizer";

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
  health_status?: {
    grade: string;
    score: number;
    status: string;
    refactor_plan: string[];
  };
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
  fileMetrics: { path: string; size: number }[];
}

interface PRAnalysisResult {
  prNumber: number;
  title: string;
  description: string;
  blastRadius: PRBlastRadiusItem[];
  architecturalChanges: string[];
  breakingDependencies: string[];
  riskLevel: "low" | "medium" | "high";
  suggestedReviewers?: { username: string; reason: string }[];
}

interface PRBlastRadiusItem {
  file: string;
  impact: string;
}

function AnalyzeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const repoUrl = searchParams.get("url") || searchParams.get("repo");
  const source = searchParams.get("source");

  const [data, setData] = useState<RepoData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showGitHubAuthModal, setShowGitHubAuthModal] = useState(false);

  const [activeTab, setActiveTab] = useState<
    "overview" | "visualizer" | "doctor" | "pr_impact"
  >("overview");
  const [mapView, setMapView] = useState<"graph" | "treemap" | "directory">(
    "graph",
  );
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const savedTab = sessionStorage.getItem("codeautopsy_tab");
    const savedView = sessionStorage.getItem("codeautopsy_view");

    if (
      savedTab &&
      ["overview", "visualizer", "doctor", "pr_impact"].includes(savedTab)
    ) {
      setActiveTab(
        savedTab as "overview" | "visualizer" | "doctor" | "pr_impact",
      );
    }

    if (savedView && ["graph", "treemap", "directory"].includes(savedView)) {
      setMapView(savedView as "graph" | "treemap" | "directory");
    }

    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (isHydrated) {
      sessionStorage.setItem("codeautopsy_tab", activeTab);
      sessionStorage.setItem("codeautopsy_view", mapView);
    }
  }, [activeTab, mapView, isHydrated]);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [hideFeedback, setHideFeedback] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [prInput, setPrInput] = useState("");
  const [isAnalyzingPR, setIsAnalyzingPR] = useState(false);
  const [prResult, setPrResult] = useState<PRAnalysisResult | null>(null);
  const [prError, setPrError] = useState<string | null>(null);

  const handleAnalyzePR = async () => {
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
          owner: data?.owner,
          repo: data?.repo,
          prNumber: extractedPrNumber,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to analyze PR");

      setPrResult(json);
    } catch (err: Error | unknown) {
      setPrError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsAnalyzingPR(false);
    }
  };

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

        const res = await fetch(`/api/analyze?t=${Date.now()}`, {
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

    if (exitAfter) router.back();
  };

  const handleBackNavigation = () => {
    if (!feedbackSubmitted) {
      setShowExitModal(true);
    } else {
      router.back();
    }
  };

  if (loading)
    return (
      <div className="h-screen w-screen bg-[#0a0a0a] flex flex-col items-center justify-center relative overflow-hidden text-slate-200 font-satoshi">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-white/[0.01] rounded-full blur-[80px] animate-pulse" />
        <div className="relative z-10 glass-card p-8 rounded-2xl border border-white/5 max-w-sm w-full mx-4">
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
                    className={`w-1 h-1 rounded-full bg-slate-400 animate-ping loading-pulse [--loading-delay:calc(${i}*0.2s)]`}
                  />
                </div>
                <span className="mono text-xs text-slate-400">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );

  if (error) {
    const isRateLimit =
      error.includes("RATE_LIMIT_REACHED") || error.includes("Daily limit");

    return (
      <div className="h-screen w-screen bg-[#0a0a0a] flex flex-col items-center justify-center font-satoshi p-4">
        <div
          className={`glass-card p-8 rounded-2xl max-w-md w-full text-center border ${isRateLimit ? "border-amber-500/20" : "border-red-500/10"}`}
        >
          <div
            className={`w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-6 border ${isRateLimit ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20"}`}
          >
            {isRateLimit ? (
              <Layers className="w-6 h-6 text-amber-400" />
            ) : (
              <Terminal className="w-6 h-6 text-red-400" />
            )}
          </div>
          <h2 className="cabinet text-2xl font-bold text-white mb-2">
            {isRateLimit ? "Daily Limit Reached" : "Autopsy Failed"}
          </h2>
          <p className="text-slate-400 text-sm mb-8">{error}</p>
          <div className="flex flex-col gap-3">
            {isRateLimit && (
              <button
                onClick={() => router.push("/pricing")}
                className="w-full px-6 py-3 rounded-xl bg-white text-black font-bold text-sm hover:scale-[1.02] transition-transform"
              >
                View Upgrade Options
              </button>
            )}
            <button
              onClick={() => router.back()}
              className="w-full px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-bold text-white transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  if (showGitHubAuthModal) {
    return (
      <div className="h-screen w-screen bg-[#0a0a0a] flex flex-col items-center justify-center relative font-satoshi p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 glass-card p-8 rounded-2xl max-w-md w-full border-2 border-white/10 bg-[#0e0e0e]"
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
        <div className="flex items-center gap-4 sm:gap-6 min-w-0">
          <button
            onClick={handleBackNavigation}
            title="Go back"
            className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors group flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div className="flex items-center gap-3 min-w-0">
            <FaGithub className="w-5 h-5 text-slate-400 hidden sm:block flex-shrink-0" />
            <h1 className="cabinet text-lg md:text-xl font-bold text-slate-100 flex items-center gap-2 truncate">
              {source === "local" ? (
                "Local Codebase"
              ) : (
                <div className="truncate">
                  <span className="text-slate-500 font-medium hidden sm:inline">
                    {data.owner}
                  </span>
                  <span className="text-slate-600 hidden sm:inline">/</span>
                  <span className="truncate">{data.repo}</span>
                </div>
              )}
            </h1>
            <div className="hidden md:flex items-center gap-2 ml-4 px-3 py-1 rounded-full bg-white/[0.02] border border-white/5 flex-shrink-0">
              <Terminal className="w-3 h-3 text-slate-500" />
              <span className="mono text-[10px] text-slate-400 font-bold uppercase">
                {data.language}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all font-mono text-[10px] uppercase tracking-widest font-bold h-9 flex-shrink-0"
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
                  <div className="flex items-center gap-1 bg-white/[0.02] border border-white/5 rounded-lg p-1 h-9 flex-shrink-0">
                    <span className="text-[10px] uppercase font-mono text-slate-500 px-3 font-bold whitespace-nowrap">
                      Helpful?
                    </span>
                    <div className="flex items-center gap-1 px-1">
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
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-green-500/10 border border-green-500/20 h-9 flex-shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                    <span className="text-[10px] uppercase font-mono text-green-400 font-bold whitespace-nowrap">
                      Thanks!
                    </span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {source !== "local" && (
            <ShareButton owner={data.owner} repo={data.repo} />
          )}
          <ExportButton data={data} />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a]">
          <div className="h-16 flex-shrink-0 border-b border-white/5 flex items-center justify-center px-4 sm:px-6 bg-[#0a0a0a]/50 backdrop-blur-sm z-20 overflow-hidden">
            <div className="flex overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] items-center gap-2 bg-[#141414]/90 backdrop-blur-xl p-1.5 rounded-xl border border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.15)] ring-1 ring-black/50 transition-all hover:shadow-[0_0_40px_rgba(255,255,255,0.25)] w-auto">
              <button
                onClick={() => setActiveTab("overview")}
                className={`flex-shrink-0 whitespace-nowrap px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest font-mono transition-all flex items-center gap-2 ${
                  activeTab === "overview"
                    ? "bg-white/10 text-white shadow-inner"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <FileCode className="w-3.5 h-3.5" /> Read Docs
              </button>
              <button
                onClick={() => setActiveTab("visualizer")}
                className={`flex-shrink-0 whitespace-nowrap px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest font-mono transition-all flex items-center gap-2 ${
                  activeTab === "visualizer"
                    ? "bg-white/10 text-white shadow-inner"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Layers className="w-3.5 h-3.5" /> Blueprint Map
              </button>
              <button
                onClick={() => setActiveTab("doctor")}
                className={`flex-shrink-0 whitespace-nowrap px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest font-mono transition-all flex items-center gap-2 ${
                  activeTab === "doctor"
                    ? "bg-white/10 text-white shadow-inner"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Activity className="w-3.5 h-3.5" /> Diagnostic Engine
              </button>
              <button
                onClick={() => setActiveTab("pr_impact")}
                className={`flex-shrink-0 whitespace-nowrap px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest font-mono transition-all flex items-center gap-2 ${
                  activeTab === "pr_impact"
                    ? "bg-white/10 text-white shadow-inner"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                <GitPullRequest className="w-3.5 h-3.5" /> PR Impact
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden relative">
            {activeTab === "overview" && (
              <div className="absolute inset-0 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                <motion.div
                  initial="hidden"
                  animate="show"
                  variants={fadeUp}
                  className="max-w-5xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-6 pb-12"
                >
                  {/* Row 1: Health Status (Left) + Right Sidebar Content (Right) */}
                  <div className="xl:col-span-8">
                    {data.analysis.health_status && (
                      <div className="glass-card relative overflow-hidden p-6 sm:p-8 rounded-2xl border border-white/10 bg-[#0e0e0e] h-full transition-all">
                        <div
                          className={`absolute -right-20 -top-20 w-64 h-64 blur-[100px] rounded-full opacity-20 pointer-events-none ${
                            data.analysis.health_status.grade === "A"
                              ? "bg-emerald-500"
                              : data.analysis.health_status.grade === "B"
                                ? "bg-blue-500"
                                : data.analysis.health_status.grade === "C"
                                  ? "bg-amber-500"
                                  : data.analysis.health_status.grade === "D"
                                    ? "bg-orange-500"
                                    : "bg-red-500"
                          }`}
                        />

                        <div className="flex flex-col md:flex-row gap-8 items-center md:items-start relative z-10 text-center md:text-left">
                          <div
                            className={`flex-shrink-0 w-32 h-32 rounded-3xl flex flex-col items-center justify-center border-2 shadow-[0_0_30px_rgba(0,0,0,0.5)] ${
                              data.analysis.health_status.grade === "A"
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                : data.analysis.health_status.grade === "B"
                                  ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                                  : data.analysis.health_status.grade === "C"
                                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                    : data.analysis.health_status.grade === "D"
                                      ? "bg-orange-500/10 border-orange-500/30 text-orange-400"
                                      : "bg-red-500/10 border-red-500/30 text-red-400"
                            }`}
                          >
                            <span className="text-6xl font-black cabinet leading-none tracking-tighter">
                              {data.analysis.health_status.grade}
                            </span>
                            <span className="text-xs font-mono font-bold uppercase tracking-widest mt-2 opacity-80">
                              {data.analysis.health_status.score} / 100
                            </span>
                          </div>

                          <div className="flex-1 space-y-4">
                            <div>
                              <h2 className="cabinet text-2xl font-bold text-white mb-1">
                                {data.analysis.health_status.status}
                              </h2>
                              <p className="text-slate-400 text-sm">
                                Based on live coupling, circular dependencies,
                                and file bloat metrics.
                              </p>
                            </div>

                            <div className="pt-2 w-full flex justify-center md:justify-start">
                              <BadgeEmbed
                                repoName={`${data.owner}/${data.repo}`}
                              />
                            </div>

                            {data.analysis.health_status.refactor_plan && (
                              <div className="space-y-2 mt-4 text-left">
                                <h3 className="mono text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                                  AI Refactoring Directives
                                </h3>
                                {data.analysis.health_status.refactor_plan.map(
                                  (step, i) => (
                                    <div
                                      key={i}
                                      className="flex gap-3 items-start p-3 rounded-xl bg-white/[0.02] border border-white/5"
                                    >
                                      <div className="w-5 h-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                        <span className="mono text-[9px] text-slate-400 font-bold">
                                          {i + 1}
                                        </span>
                                      </div>
                                      <p className="text-xs text-slate-300 leading-relaxed">
                                        {step}
                                      </p>
                                    </div>
                                  ),
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="xl:col-span-4 h-full">
                    <div className="glass-card p-6 rounded-2xl border border-white/10 bg-[#0e0e0e] h-full flex flex-col space-y-6">
                      {data.analysis.blast_radius &&
                        data.analysis.blast_radius.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 mb-2 px-1">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500/80" />
                              <h2 className="mono text-[10px] font-bold uppercase tracking-widest text-amber-500/80">
                                Blast Radius
                              </h2>
                            </div>
                            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
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
                                    <Layers className="w-3 h-3" />{" "}
                                    {risk.dependents} Dependent File(s)
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      <div className="space-y-3 flex-1 flex flex-col min-h-0">
                        <h2 className="mono text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 px-1">
                          Key Modules
                        </h2>
                        <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1">
                          {data.analysis.key_modules.map((mod, i) => (
                            <div
                              key={i}
                              className="glass-card p-4 rounded-xl bg-white/[0.03] border border-white/5"
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
                    </div>
                  </div>

                  {/* Row 2: System Purpose (Left) + Execution/Onboarding (Right) */}
                  <div className="xl:col-span-8">
                    <div className="glass-card relative overflow-hidden p-6 sm:p-8 rounded-2xl border border-white/5 bg-[#0e0e0e] h-full flex flex-col group">
                      <div className="relative z-10 flex-1 flex flex-col">
                        <h2 className="cabinet text-xl font-bold text-white mb-4 flex items-center gap-2">
                          <Layers className="w-4 h-4 text-slate-500" /> System
                          Purpose
                        </h2>
                        <p className="text-slate-400 leading-relaxed text-sm mb-12">
                          {data.analysis.what_it_does}
                        </p>

                        {/* Stacked Layout to fill vertical space */}
                        <div className="space-y-10">
                          {/* Core Tech Stack - Horizontal List */}
                          <div className="space-y-4">
                            <h3 className="mono text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2 px-1">
                              <Cpu className="w-3 h-3" /> Core Tech Stack
                            </h3>
                            <div className="space-y-2">
                              {data.analysis.tech_stack &&
                                data.analysis.tech_stack
                                  .slice(0, 10)
                                  .map((tech, i) => (
                                    <div
                                      key={i}
                                      className="flex items-center gap-6 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-all group/item"
                                    >
                                      <div className="w-32 shrink-0">
                                        <span className="text-xs font-bold text-slate-200 group-hover/item:text-blue-400 transition-colors">
                                          {tech.name}
                                        </span>
                                      </div>
                                      <div className="h-4 w-px bg-white/10 hidden sm:block" />
                                      <span className="text-[11px] text-slate-500 leading-tight flex-1">
                                        {tech.purpose}
                                      </span>
                                    </div>
                                  ))}
                            </div>
                          </div>

                          {/* Repository Pulse - Grid below */}
                          <div className="space-y-4">
                            <h3 className="mono text-[10px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-2 px-1">
                              <Activity className="w-3 h-3" /> Repository Pulse
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {[
                                {
                                  label: "Primary Language",
                                  value: data.language,
                                  icon: Terminal,
                                },
                                {
                                  label: "Project Complexity",
                                  value: `${data.totalFiles} Source Files`,
                                  icon: FileCode,
                                },
                                {
                                  label: "Architecture Pattern",
                                  value: data.analysis.architecture_pattern,
                                  icon: Layers,
                                },
                                {
                                  label: "Popularity / Stars",
                                  value:
                                    data.stars > 0
                                      ? `${data.stars} Stars`
                                      : "Early Stage",
                                  icon: ThumbsUp,
                                },
                              ].map((stat, i) => (
                                <div
                                  key={i}
                                  className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.01] border border-white/5 hover:bg-white/[0.03] transition-all"
                                >
                                  <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
                                    <stat.icon className="w-5 h-5 text-slate-400" />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="mono text-[9px] text-slate-600 uppercase font-bold">
                                      {stat.label}
                                    </span>
                                    <span className="text-xs font-mono text-slate-300">
                                      {stat.value}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="xl:col-span-4 space-y-6">
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
                </motion.div>
              </div>
            )}

            {activeTab === "visualizer" && data && (
              <div className="absolute inset-0 p-4 flex flex-col gap-3">
                <div className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 px-1 flex-shrink-0">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-bold text-slate-300 font-mono tracking-widest uppercase">
                      Blueprint Map
                    </h3>
                    <span className="text-[10px] font-mono text-slate-500">
                      VISUAL LAYOUT
                    </span>
                  </div>

                  <div className="flex overflow-x-auto w-full sm:w-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] bg-[#141414]/90 backdrop-blur-xl p-1 rounded-xl border border-white/20 shadow-[0_0_15px_rgba(0,0,0,0.5)]">
                    <button
                      onClick={() => setMapView("graph")}
                      className={`flex-shrink-0 whitespace-nowrap px-4 py-1.5 text-[10px] font-mono uppercase tracking-widest rounded-lg transition-all ${
                        mapView === "graph"
                          ? "bg-white/10 text-white font-bold shadow-inner"
                          : "text-slate-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      Dependency Flow
                    </button>
                    <button
                      onClick={() => setMapView("directory")}
                      className={`flex-shrink-0 whitespace-nowrap px-4 py-1.5 text-[10px] font-mono uppercase tracking-widest rounded-lg transition-all ${
                        mapView === "directory"
                          ? "bg-white/10 text-white font-bold shadow-inner"
                          : "text-slate-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      Folder Structure
                    </button>
                    <button
                      onClick={() => setMapView("treemap")}
                      className={`flex-shrink-0 whitespace-nowrap px-4 py-1.5 text-[10px] font-mono uppercase tracking-widest rounded-lg transition-all ${
                        mapView === "treemap"
                          ? "bg-white/10 text-white font-bold shadow-inner"
                          : "text-slate-400 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      Codebase Weight
                    </button>
                  </div>
                </div>

                <div className="flex-1 w-full rounded-2xl border border-white/10 overflow-hidden bg-black shadow-2xl relative">
                  {mapView === "graph" ? (
                    data.dependencyGraph &&
                    Object.keys(data.dependencyGraph).length > 0 ? (
                      <ArchitectureMap
                        dependencyGraph={data.dependencyGraph}
                        entryPoints={data.entryPoints}
                      />
                    ) : (
                      <div className="w-full h-full bg-[#0e0e0e] flex flex-col items-center justify-center p-4 text-center">
                        <Layers className="w-10 h-10 text-slate-600 mb-4" />
                        <p className="text-slate-500 font-mono text-xs">
                          No blueprint data parsed for this codebase.
                        </p>
                      </div>
                    )
                  ) : mapView === "directory" ? (
                    <DirectoryTreeVisualizer metrics={data.fileMetrics} />
                  ) : (
                    <TreemapVisualizer metrics={data.fileMetrics} />
                  )}
                </div>
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
                    <div className="w-full h-full rounded-2xl border border-white/5 bg-[#0e0e0e] flex flex-col items-center justify-center min-h-[600px] p-4 text-center">
                      <Terminal className="w-10 h-10 text-slate-600 mb-4" />
                      <p className="text-slate-500 font-mono text-xs">
                        Diagnostic core offline.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "pr_impact" && (
              <div className="absolute inset-0 p-4 sm:p-6 flex flex-col items-center justify-center overflow-y-auto">
                <div className="max-w-xl w-full glass-card p-6 sm:p-8 rounded-2xl border border-white/10 bg-[#0e0e0e]/80 text-center shadow-2xl transition-all my-auto">
                  {!prResult ? (
                    <>
                      <div className="w-16 h-16 mx-auto rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-6">
                        <GitPullRequest className="w-8 h-8 text-slate-300" />
                      </div>
                      <h2 className="cabinet text-2xl font-bold text-white mb-3">
                        PR Impact Analyzer
                      </h2>
                      <p className="text-slate-400 text-sm leading-relaxed mb-8">
                        Paste a Pull Request number to instantly calculate its
                        blast radius, preview architectural changes, and
                        identify breaking dependencies before merging.
                      </p>

                      <div
                        className={`flex flex-col sm:flex-row items-center gap-3 bg-black/50 border rounded-xl p-2 transition-colors ${prError ? "border-red-500/50" : "border-white/10 focus-within:border-white/30"}`}
                      >
                        <div className="flex w-full sm:w-auto flex-1 items-center bg-transparent">
                          <span className="text-slate-500 font-mono text-sm pl-3 pr-2 border-r border-white/10">
                            PR #
                          </span>
                          <input
                            type="text"
                            value={prInput}
                            onChange={(e) => setPrInput(e.target.value)}
                            onKeyDown={(e) =>
                              e.key === "Enter" && handleAnalyzePR()
                            }
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
                    <div className="w-full text-left animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 pb-6 border-b border-white/10 gap-4">
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
                          )}
                          {prResult.riskLevel} Risk
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div className="space-y-4">
                          <h4 className="text-xs font-mono font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Activity className="w-4 h-4" /> Blast Radius
                          </h4>
                          <div className="space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar pr-2">
                            {prResult.blastRadius.map(
                              (item: PRBlastRadiusItem, i: number) => (
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
                              ),
                            )}
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
                              <Layers className="w-4 h-4" /> Architectural
                              Changes
                            </h4>
                            <ul className="space-y-2 p-3 rounded-lg border border-white/5 bg-[#0e0e0e]">
                              {prResult.architecturalChanges.map(
                                (change: string, i: number) => (
                                  <li
                                    key={i}
                                    className="flex items-start gap-2 text-xs text-slate-400"
                                  >
                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-600 mt-1 flex-shrink-0" />
                                    {change}
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>

                          <div className="space-y-3">
                            <h4 className="text-xs font-mono font-bold text-amber-500/70 uppercase tracking-widest flex items-center gap-2">
                              <GitMerge className="w-4 h-4" /> Breaking
                              Dependencies
                            </h4>
                            <div className="p-3 rounded-lg border border-amber-500/10 bg-amber-500/[0.02]">
                              <ul className="space-y-2">
                                {(Array.isArray(prResult.breakingDependencies)
                                  ? prResult.breakingDependencies
                                  : [
                                      prResult.breakingDependencies ||
                                        "None detected",
                                    ]
                                ).map((dep: unknown, i: number) => (
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
                      </div>

                      {prResult.suggestedReviewers &&
                        prResult.suggestedReviewers.length > 0 && (
                          <div className="mt-8 space-y-4 text-left border-t border-white/5 pt-6">
                            <h4 className="text-xs font-mono font-bold text-blue-400 uppercase tracking-widest flex items-center gap-2">
                              <Users className="w-4 h-4" /> Context-Aware
                              Reviewers
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              {prResult.suggestedReviewers.map(
                                (reviewer, i) => (
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
                                        e.currentTarget.src =
                                          "https://github.com/ghost.png";
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
                                ),
                              )}
                            </div>
                          </div>
                        )}
                      {/* ------------------------------------- */}

                      <div className="flex justify-center border-t border-white/10 pt-6">
                        <button
                          onClick={() => {
                            setPrResult(null);
                            setPrInput("");
                          }}
                          className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-bold text-slate-300 transition-all flex items-center justify-center gap-2"
                        >
                          <ArrowLeft className="w-4 h-4" /> Analyze Another PR
                        </button>
                      </div>
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
              <div className="flex-col text-left hidden sm:flex">
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
              animate={{ width: "min(100vw, 420px)", opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: EXPO_OUT }}
              className="h-full flex-shrink-0 border-l border-white/5 bg-[#0a0a0a] flex flex-col z-50 absolute right-0 sm:relative shadow-[-20px_0_40px_rgba(0,0,0,0.5)]"
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
                  title="Close chat"
                  aria-label="Close chat"
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
              onClick={() => router.back()}
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
                  onClick={() => router.back()}
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
