"use client";

import { useSearchParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import {
  useEffect,
  useState,
  Suspense,
  useMemo,
  useCallback,
  useRef,
  memo,
} from "react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ArrowLeft,
  FileCode,
  Terminal,
  Cpu,
  Layers,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  X,
  LayoutGrid,
  Activity,
  GitPullRequest,
  Target,
  CheckCircle2,
} from "lucide-react";
import { FaGithub } from "react-icons/fa";

// Global Components
import ExportButton from "@/components/ExportButton";
import ShareButton from "@/components/ShareButton";
import { createClient } from "@/lib/supabase-browser";
import { RepoData } from "@/lib/types/analyze";

// --- Skeleton Extracted (No Re-allocation) ---
const SkeletonLoader = memo(() => (
  <div className="w-full h-full space-y-4 p-6 animate-pulse">
    <div className="h-8 bg-white/5 rounded-lg w-1/3" />
    <div className="h-64 bg-white/5 rounded-xl" />
    <div className="grid grid-cols-2 gap-4">
      <div className="h-32 bg-white/5 rounded-lg" />
      <div className="h-32 bg-white/5 rounded-lg" />
    </div>
  </div>
));
SkeletonLoader.displayName = "SkeletonLoader";

// --- Lazy Load ALL Tab Components ---
const OverviewTab = dynamic(() => import("@/components/analyze/OverviewTab"), {
  loading: () => <SkeletonLoader />,
  ssr: false,
});
const PrImpactTab = dynamic(() => import("@/components/analyze/PrImpactTab"), {
  loading: () => <SkeletonLoader />,
  ssr: false,
});
const DebugInterface = dynamic(
  () => import("@/components/debug/DebugInterface"),
  { loading: () => <SkeletonLoader />, ssr: false },
);
const ArchitectureMap = dynamic(() => import("@/components/ArchitectureMap"), {
  loading: () => <SkeletonLoader />,
  ssr: false,
});
const TreemapVisualizer = dynamic(
  () => import("@/components/TreemapVisualizer"),
  { loading: () => <SkeletonLoader />, ssr: false },
);
const DirectoryTreeVisualizer = dynamic(
  () => import("@/components/DirectoryTreeVisualizer"),
  { loading: () => <SkeletonLoader />, ssr: false },
);
const RiskDashboard = dynamic(() => import("@/components/RiskDashboard"), {
  loading: () => <SkeletonLoader />,
  ssr: false,
});
const RepoChat = dynamic(() => import("@/components/RepoChat"), {
  loading: () => <SkeletonLoader />,
  ssr: false,
});
const InterviewChatPanel = dynamic(
  () => import("@/components/interview/InterviewChatPanel"),
  { loading: () => <SkeletonLoader />, ssr: false },
);

const EXPO_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

// --- Tab & View Config (No Re-allocation) ---
const TAB_CONFIG = [
  { id: "overview" as const, icon: FileCode, label: "Read Docs" },
  { id: "visualizer" as const, icon: Layers, label: "Blueprint Map" },
  { id: "doctor" as const, icon: Activity, label: "Diagnostic Engine" },
  { id: "pr_impact" as const, icon: GitPullRequest, label: "PR Impact" },
  { id: "risk_radar" as const, icon: Target, label: "Risk Radar" },
] as const;

const MAP_VIEW_CONFIG = [
  { id: "graph" as const, label: "Dependency Flow" },
  { id: "directory" as const, label: "Folder Structure" },
  { id: "treemap" as const, label: "Codebase Weight" },
] as const;

const LOADING_PHRASES = [
  "Cloning repository...",
  "Decrypting source tree...",
  "Mapping AST nodes...",
  "Tracing execution flows...",
  "Calculating blast radius...",
  "Evaluating test coverage...",
  "Querying Groq LLM...",
  "Compiling health report...",
] as const;

// Default skeleton analysis shown while AI stream is starting
const DEFAULT_ANALYSIS = {
  architecture_pattern: "Analyzing...",
  what_it_does: "Waking up Groq LLM...",
  execution_flow: [],
  tech_stack: [],
  key_modules: [],
  onboarding_guide: [],
  evidence_paths: [],
  blast_radius: [],
  health_status: {
    grade: "-",
    score: 0,
    status: "Pending",
    refactor_plan: [],
  },
} as const;

type TabType = (typeof TAB_CONFIG)[number]["id"];
type MapViewType = (typeof MAP_VIEW_CONFIG)[number]["id"];

// --- Memoized Component (Prevents Unnecessary Re-renders) ---
const AnalyzeContent = memo(() => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const repoUrl = searchParams.get("url") || searchParams.get("repo");
  const source = searchParams.get("source");

  // UI State
  const [showGitHubAuthModal, setShowGitHubAuthModal] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [hideFeedback, setHideFeedback] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const exitModalRef = useRef<HTMLDivElement>(null);

  // AI Streaming State
  const [aiAnalysis, setAiAnalysis] = useState<Record<string, unknown> | null>(
    null,
  );
  const [isAiStreaming, setIsAiStreaming] = useState(false);

  // Mount Flag
  const [isMounted, setIsMounted] = useState(false);

  // Safe Synchronous Initialization (Only runs in browser)
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    if (typeof window === "undefined") return "overview";
    const saved = sessionStorage.getItem("codeautopsy_tab");
    return saved && TAB_CONFIG.some((t) => t.id === saved)
      ? (saved as TabType)
      : "overview";
  });

  const [mapView, setMapView] = useState<MapViewType>(() => {
    if (typeof window === "undefined") return "graph";
    const saved = sessionStorage.getItem("codeautopsy_view");
    return saved && MAP_VIEW_CONFIG.some((v) => v.id === saved)
      ? (saved as MapViewType)
      : "graph";
  });

  // Mark as mounted
  useEffect(() => {
    const timeoutId = setTimeout(() => setIsMounted(true), 0);
    return () => clearTimeout(timeoutId);
  }, []);

  // Sync tab/view changes to sessionStorage
  useEffect(() => {
    if (isMounted) {
      sessionStorage.setItem("codeautopsy_tab", activeTab);
      sessionStorage.setItem("codeautopsy_view", mapView);
    }
  }, [activeTab, mapView, isMounted]);

  // --- Local Codebase Handler (Bypasses API) ---
  const [localData] = useState<RepoData | null>(() => {
    if (typeof window === "undefined" || source !== "local") return null;
    const stored = sessionStorage.getItem("localAnalysisResult");
    return stored ? JSON.parse(stored) : null;
  });

  const [localError] = useState<string | null>(() => {
    if (typeof window === "undefined" || source !== "local") return null;
    const stored = sessionStorage.getItem("localAnalysisResult");
    return !stored
      ? "Local analysis data expired or lost. Please return to home and upload again."
      : null;
  });

  // --- Remote API Fetching (SWR Cache) ---
  const {
    data: swrData,
    error: swrError,
    isLoading: swrLoading,
  } = useSWR(
    repoUrl && source !== "local" ? ["/api/analyze", repoUrl] : null,
    ([url, repo]) => fetcher(url, repo),
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      onError: (err) => {
        if (err.message === "REQUIRE_GITHUB_AUTH") setShowGitHubAuthModal(true);
      },
    },
  );

  // --- REAL-TIME AI STREAMING ENGINE ---
  useEffect(() => {
    if (swrData && swrData.analysis === null && !isAiStreaming && !aiAnalysis) {
      setIsAiStreaming(true);

      const fetchAiStream = async () => {
        try {
          const res = await fetch("/api/ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              repoName: `${swrData.owner}/${swrData.repo}`,
              description: swrData.description,
              entryPoints: swrData.entryPoints,
              topFiles: swrData.topFilesForGroq,
              fileContents: swrData.fileContents,
              blastRadiusTargets: swrData.blastRadiusTargets,
              healthMetrics: swrData.healthMetrics,
            }),
          });

          if (!res.body) return;

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let jsonText = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            jsonText += decoder.decode(value, { stream: true });

            // 1. Try to parse the complete JSON first
            try {
              setAiAnalysis(JSON.parse(jsonText));
            } catch {
              // 2. On-the-fly Partial JSON Repair for live UI rendering
              try {
                let fixed = jsonText.replace(/("[^"]*)$/, '"'); // Close any open string
                const openBraces = (fixed.match(/\{/g) || []).length;
                const closeBraces = (fixed.match(/\}/g) || []).length;
                const openBrackets = (fixed.match(/\[/g) || []).length;
                const closeBrackets = (fixed.match(/\]/g) || []).length;

                fixed +=
                  "]".repeat(Math.max(0, openBrackets - closeBrackets)) +
                  "}".repeat(Math.max(0, openBraces - closeBraces));

                const partial = JSON.parse(fixed);
                if (partial) setAiAnalysis(partial);
              } catch {
                // Silently wait for the next chunk if still unparseable
              }
            }
          }
        } catch (err) {
          console.error("AI Stream Failed:", err);
        } finally {
          setIsAiStreaming(false);
        }
      };

      fetchAiStream();
    }
  }, [swrData, isAiStreaming, aiAnalysis]);

  // --- Unify Data Sources with Zod Bypass + AI Stream Injection ---
  const isLocal = source === "local";
  const loading = isLocal ? !localData && !localError : swrLoading;
  const rawError = isLocal
    ? localError
    : swrError?.message === "REQUIRE_GITHUB_AUTH"
      ? null
      : swrError?.message;

  const data = useMemo(() => {
    if (isLocal) return localData;
    if (!swrData || swrError) return null;

    // Bypass strict Zod validation: the incoming AI stream is intentionally incomplete.
    // Inject streaming aiAnalysis (or a safe placeholder) directly into the SWR payload.
    return {
      ...swrData,
      analysis:
        aiAnalysis ??
        (swrData.analysis === null ? DEFAULT_ANALYSIS : swrData.analysis),
    };
  }, [isLocal, localData, swrData, swrError, aiAnalysis]);

  const error = rawError ?? null;

  const isRateLimit = useMemo(
    () =>
      !!error &&
      (error.includes("RATE_LIMIT_REACHED") || error.includes("Daily limit")),
    [error],
  );

  // Loading Animation Loop
  const [loadingStep, setLoadingStep] = useState(0);
  const loadingControls = useAnimationControls();

  useEffect(() => {
    if (!loading) return;
    let isActive = true;

    const animate = async () => {
      while (isActive) {
        await loadingControls.start({
          opacity: [0, 1],
          transition: { duration: 0.4, ease: "easeOut" },
        });
        await new Promise((resolve) => setTimeout(resolve, 800));
        await loadingControls.start({
          opacity: [1, 0],
          transition: { duration: 0.4, ease: "easeIn" },
        });
        if (isActive)
          setLoadingStep((prev) => (prev + 1) % LOADING_PHRASES.length);
      }
    };

    animate();
    return () => {
      isActive = false;
    };
  }, [loading, loadingControls]);

  // Escape Key & Modal Focus Traps
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (showExitModal) setShowExitModal(false);
      else if (showGitHubAuthModal) router.push("/");
      else if (isChatOpen) setIsChatOpen(false);
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showExitModal, showGitHubAuthModal, isChatOpen, router]);

  useEffect(() => {
    if (!showExitModal) return;
    const modal = exitModalRef.current;
    if (!modal) return;

    const focusable = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else if (document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };

    first?.focus();
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [showExitModal]);

  // Handlers
  const handleGitHubLogin = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        scopes: "user:email",
        redirectTo: `${window.location.origin}/analyze?repo=${encodeURIComponent(repoUrl || "")}`,
      },
    });
  }, [repoUrl]);

  const handleFeedback = useCallback(
    async (isHelpful: boolean, exitAfter = false) => {
      setFeedbackSubmitted(true);
      if (exitAfter) setShowExitModal(false);
      else setTimeout(() => setHideFeedback(true), 2000);

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
    },
    [data, repoUrl, router],
  );

  const handleBackNavigation = useCallback(() => {
    if (!feedbackSubmitted) setShowExitModal(true);
    else router.back();
  }, [feedbackSubmitted, router]);

  // --- RENDERING ROUTER ---

  if (!isMounted || loading)
    return (
      <div className="h-screen w-screen bg-[#0a0a0a] flex flex-col items-center justify-center relative overflow-hidden text-slate-200 font-satoshi">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-white/[0.01] rounded-full blur-[80px] animate-pulse" />
        <div className="relative z-10 glass-card p-8 rounded-2xl border border-white/5 max-w-sm w-full mx-4 shadow-2xl">
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/5">
            <div className="w-10 h-10 rounded-xl bg-[#141414] border border-white/10 flex items-center justify-center shadow-inner">
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
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded flex items-center justify-center bg-emerald-500/20 border border-emerald-500/50">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              </div>
              <motion.span
                animate={loadingControls}
                className="mono text-xs text-emerald-400 font-medium"
              >
                {LOADING_PHRASES[loadingStep]}
              </motion.span>
            </div>
          </div>
        </div>
      </div>
    );

  if (error)
    return (
      <div className="h-screen w-screen bg-[#0a0a0a] flex flex-col items-center justify-center font-satoshi p-4">
        <div
          className={`glass-card p-8 rounded-2xl max-w-lg w-full text-center border ${isRateLimit ? "border-amber-500/20" : "border-red-500/10"}`}
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
          <h2 className="cabinet text-2xl font-bold text-white mb-4">
            {isRateLimit ? "Daily Limit Reached" : "Autopsy Failed"}
          </h2>
          <div className="w-full max-h-[200px] overflow-y-auto custom-scrollbar p-4 mb-8 rounded-lg bg-[#0e0e0e] border border-white/5 shadow-inner text-left">
            <p className="text-xs leading-relaxed font-mono text-red-400 break-words whitespace-pre-wrap">
              {error}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {isRateLimit && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => router.push("/pricing")}
                className="w-full px-6 py-3 rounded-xl bg-white text-black font-bold text-sm hover:scale-[1.02] transition-transform"
              >
                View Upgrade Options
              </motion.button>
            )}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => router.back()}
              className="w-full px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-sm font-bold text-white transition-all flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" /> Go Back
            </motion.button>
          </div>
        </div>
      </div>
    );

  if (!data) return null;

  if (showGitHubAuthModal)
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
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={handleGitHubLogin}
              className="w-full bg-white text-black px-6 py-4 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all flex items-center justify-center gap-3"
            >
              <FaGithub className="w-5 h-5" /> Connect GitHub Account
            </motion.button>
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

  return (
    <div className="h-screen w-screen bg-[#0a0a0a] text-slate-200 overflow-hidden flex flex-col font-satoshi">
      {/* HEADER */}
      <header className="h-16 flex-shrink-0 border-b border-white/5 bg-[#0e0e0e] flex items-center justify-between px-4 lg:px-6 z-20">
        <div className="flex items-center gap-4 sm:gap-6 min-w-0">
          <button
            onClick={handleBackNavigation}
            aria-label="Go back"
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
            {/* Streaming indicator badge */}
            {isAiStreaming && (
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex-shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="mono text-[9px] text-emerald-400 font-bold uppercase tracking-widest">
                  AI Live
                </span>
              </div>
            )}
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
                        onClick={() => handleFeedback(true)}
                        aria-label="Mark as helpful"
                        className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-green-400 transition-colors"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleFeedback(false)}
                        aria-label="Mark as not helpful"
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

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a]">
          {/* TAB LIST */}
          <div
            role="tablist"
            aria-label="Analysis Tools"
            className="h-16 flex-shrink-0 border-b border-white/5 flex items-center justify-center px-4 sm:px-6 bg-[#0a0a0a]/50 backdrop-blur-sm z-20 overflow-hidden"
          >
            <div className="flex overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] items-center gap-2 bg-[#141414]/90 backdrop-blur-xl p-1.5 rounded-xl border border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.15)] ring-1 ring-black/50 transition-all hover:shadow-[0_0_40px_rgba(255,255,255,0.25)] w-auto">
              {TAB_CONFIG.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    type="button"
                    key={tab.id}
                    role="tab"
                    aria-selected={isActive ? "true" : "false"}
                    aria-controls={`tabpanel-${tab.id}`}
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex-shrink-0 whitespace-nowrap px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest font-mono transition-colors flex items-center gap-2 ${isActive ? "text-white" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="active-tab-highlight"
                        className="absolute inset-0 bg-white/10 rounded-lg shadow-inner border border-white/10"
                        initial={false}
                        transition={{
                          type: "spring",
                          bounce: 0.2,
                          duration: 0.6,
                        }}
                      />
                    )}
                    <tab.icon className="w-3.5 h-3.5 relative z-10" />
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TAB PANELS */}
          <div className="flex-1 overflow-hidden relative">
            <AnimatePresence mode="wait">
              {activeTab === "overview" && (
                <ErrorBoundary
                  key="overview-boundary"
                  fallbackMessage="Failed to load overview."
                >
                  <OverviewTab data={data} />
                </ErrorBoundary>
              )}

              {activeTab === "pr_impact" && (
                <ErrorBoundary
                  key="pr-boundary"
                  fallbackMessage="Failed to load PR impact analyzer."
                >
                  <PrImpactTab data={data} />
                </ErrorBoundary>
              )}

              {activeTab === "visualizer" && data && (
                <motion.div
                  key="visualizer"
                  role="tabpanel"
                  id="tabpanel-visualizer"
                  aria-labelledby="tab-visualizer"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 30,
                    mass: 0.8,
                  }}
                  className="absolute inset-0 p-4 flex flex-col gap-3"
                >
                  <div className="relative w-full flex flex-col sm:flex-row items-center justify-center gap-4 px-1 py-2 flex-shrink-0">
                    <div className="flex flex-col gap-1 w-full sm:w-auto sm:absolute sm:left-2 text-left">
                      <h3 className="text-sm font-bold text-slate-300 font-mono tracking-widest uppercase">
                        Blueprint Map
                      </h3>
                      <span className="text-[10px] font-mono text-slate-500">
                        VISUAL LAYOUT
                      </span>
                    </div>
                    <div className="flex overflow-x-auto w-full sm:w-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] bg-[#141414]/90 backdrop-blur-xl p-1 rounded-xl border border-white/20 shadow-[0_0_15px_rgba(0,0,0,0.5)] z-10">
                      {MAP_VIEW_CONFIG.map((view) => (
                        <button
                          key={view.id}
                          onClick={() => setMapView(view.id)}
                          className={`flex-shrink-0 whitespace-nowrap px-4 py-1.5 text-[10px] font-mono uppercase tracking-widest rounded-lg transition-all ${mapView === view.id ? "bg-white/10 text-white font-bold shadow-inner" : "text-slate-400 hover:text-white hover:bg-white/5"}`}
                        >
                          {view.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 w-full rounded-2xl border border-white/10 overflow-hidden bg-black shadow-2xl relative">
                    <ErrorBoundary fallbackMessage="Failed to render architecture map.">
                      {mapView === "graph" ? (
                        data.dependencyGraph &&
                        Object.keys(data.dependencyGraph).length > 0 ? (
                          <>
                            <ArchitectureMap
                              dependencyGraph={data.dependencyGraph}
                              entryPoints={data.entryPoints}
                            />
                            <InterviewChatPanel
                              dependencyGraph={data.dependencyGraph}
                              entryPoints={data.entryPoints}
                              fileContents={
                                data.fileContents
                                  ? Object.fromEntries(
                                      (
                                        data.fileContents as {
                                          path: string;
                                          content: string;
                                        }[]
                                      ).map((f) => [f.path, f.content]),
                                    )
                                  : undefined
                              }
                            />
                          </>
                        ) : (
                          <div className="w-full h-full bg-[#0e0e0e] flex flex-col items-center justify-center p-4 text-center">
                            <Layers className="w-10 h-10 text-slate-600 mb-4" />
                            <p className="text-slate-500 font-mono text-xs">
                              No blueprint data parsed.
                            </p>
                          </div>
                        )
                      ) : mapView === "directory" ? (
                        <DirectoryTreeVisualizer metrics={data.fileMetrics} />
                      ) : (
                        <TreemapVisualizer metrics={data.fileMetrics} />
                      )}
                    </ErrorBoundary>
                  </div>
                </motion.div>
              )}

              {activeTab === "doctor" && (
                <motion.div
                  key="doctor"
                  role="tabpanel"
                  id="tabpanel-doctor"
                  aria-labelledby="tab-doctor"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 30,
                    mass: 0.8,
                  }}
                  className="absolute inset-0 overflow-hidden p-4"
                >
                  <div className="flex flex-col gap-4 h-full">
                    {data.mermaidDiagram ? (
                      <>
                        <div className="w-full flex-1 min-h-0 rounded-2xl border border-white/5 overflow-hidden bg-[#0e0e0e] relative">
                          <ErrorBoundary fallbackMessage="Diagnostic interface crashed.">
                            <DebugInterface
                              repoUrl={
                                source === "local"
                                  ? "Local.zip Codebase"
                                  : `https://github.com/${data.owner}/${data.repo}`
                              }
                            />
                          </ErrorBoundary>
                        </div>
                        <motion.button
                          whileTap={{ scale: 0.99 }}
                          onClick={() => setIsChatOpen(true)}
                          className="w-full flex-shrink-0 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center justify-center gap-3 group shadow-lg"
                        >
                          <MessageSquare className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
                          <span className="text-sm font-bold text-slate-300 group-hover:text-white transition-colors">
                            Discuss this diagnosis in Copilot &rarr;
                          </span>
                        </motion.button>
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
                </motion.div>
              )}

              {activeTab === "risk_radar" && (
                <motion.div
                  key="risk_radar"
                  role="tabpanel"
                  id="tabpanel-risk_radar"
                  aria-labelledby="tab-risk_radar"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{
                    type: "spring",
                    stiffness: 380,
                    damping: 30,
                    mass: 0.8,
                  }}
                  className="absolute inset-0 p-4 sm:p-6 overflow-y-auto custom-scrollbar"
                >
                  {data.coverageGaps && data.fileContents ? (
                    <ErrorBoundary fallbackMessage="Risk dashboard failed to load.">
                      <RiskDashboard
                        coverageGaps={data.coverageGaps}
                        fileContents={data.fileContents}
                      />
                    </ErrorBoundary>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-500 font-mono text-sm">
                      No risk data available for this codebase.
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* CHAT / COPILOT PANEL */}
        <AnimatePresence>
          {!isChatOpen && (
            <motion.button
              type="button"
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              onClick={() => setIsChatOpen(true)}
              aria-label="Open chat assistant"
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
              style={{ willChange: "width, opacity" }}
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
                  aria-label="Close chat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 min-h-0 bg-transparent">
                <ErrorBoundary fallbackMessage="Copilot encountered a critical error.">
                  <RepoChat
                    repoContext={
                      data as unknown as {
                        repo?: string;
                        [key: string]: string | undefined;
                      }
                    }
                  />
                </ErrorBoundary>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* EXIT MODAL */}
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
              ref={exitModalRef}
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
});
AnalyzeContent.displayName = "AnalyzeContent";

export default function AnalyzePage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen w-screen bg-[#0a0a0a] flex items-center justify-center text-slate-500 font-mono text-sm tracking-widest uppercase">
          <SkeletonLoader />
        </div>
      }
    >
      <AnalyzeContent />
    </Suspense>
  );
}
