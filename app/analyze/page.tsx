"use client";

import {
  useEffect,
  useState,
  useRef,
  useCallback,
  Suspense,
  memo,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { createClient } from "@/lib/supabase-browser";

// ─── Hooks ────────────────────────────────────────────────────────────────────
import { useAnalyzeData } from "@/hooks/analyze/useAnalyzeData";
import { useAnalyzeUIState } from "@/hooks/analyze/useAnalyzeUIState";
import { useFeedback } from "@/hooks/analyze/useFeedback";
import { useLoadingAnimation } from "@/hooks/analyze/useLoadingAnimation";

// ─── Components ───────────────────────────────────────────────────────────────
import SkeletonLoader from "@/components/analyze/SkeletonLoader";
import AnalyzeLoadingScreen from "@/components/analyze/AnalyzeLoadingScreen";
import AnalyzeErrorScreen from "@/components/analyze/AnalyzeErrorScreen";
import GitHubAuthModal from "@/components/analyze/GitHubAuthModal";
import AnalyzeHeader from "@/components/analyze/AnalyzeHeader";
import AnalyzeTabBar from "@/components/analyze/AnalyzeTabBar";
import VisualizerPanel from "@/components/analyze/VisualizerPanel";
import DoctorPanel from "@/components/analyze/DoctorPanel";
import RiskRadarPanel from "@/components/analyze/RiskRadarPanel";
import ChatPanel from "@/components/analyze/ChatPanel";
import ExitModal from "@/components/analyze/ExitModal";

// ─── Lazy Tab Panels (unchanged from original) ────────────────────────────────
const OverviewTab = dynamic(() => import("@/components/analyze/OverviewTab"), {
  loading: () => <SkeletonLoader />,
  ssr: false,
});
const PrImpactTab = dynamic(() => import("@/components/analyze/PrImpactTab"), {
  loading: () => <SkeletonLoader />,
  ssr: false,
});

// ─────────────────────────────────────────────────────────────────────────────

const AnalyzeContent = memo(() => {
  const searchParams = useSearchParams();
  const router = useRouter();

  const repoUrl = searchParams.get("url") || searchParams.get("repo");
  const source = searchParams.get("source");

  // ── Mount flag (prevents SSR / sessionStorage mismatches) ──────────────────
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setIsMounted(true), 0);
    return () => clearTimeout(id);
  }, []);

  // ── GitHub Auth Modal ───────────────────────────────────────────────────────
  const [showGitHubAuthModal, setShowGitHubAuthModal] = useState(false);

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data, loading, error, isRateLimit, isAiStreaming } = useAnalyzeData({
    repoUrl,
    source,
    onRequireGitHubAuth: () => setShowGitHubAuthModal(true),
  });

  // ── UI State ────────────────────────────────────────────────────────────────
  const {
    activeTab,
    setActiveTab,
    mapView,
    setMapView,
    isChatOpen,
    setIsChatOpen,
    showExitModal,
    setShowExitModal,
  } = useAnalyzeUIState({
    onEscapeFromAuthModal: () => router.push("/"),
    showGitHubAuthModal,
    isMounted,
  });

  // ── Exit modal focus trap ref ───────────────────────────────────────────────
  const exitModalRef = useRef<HTMLDivElement>(null);

  // ── Feedback ────────────────────────────────────────────────────────────────
  const { feedbackSubmitted, hideFeedback, handleFeedback } = useFeedback({
    repoName: data?.repo,
    repoUrl,
    onExit: () => router.back(),
    onCloseExitModal: () => setShowExitModal(false),
  });

  // ── Loading animation ───────────────────────────────────────────────────────
  const { loadingStep, loadingControls } = useLoadingAnimation(loading);

  // ── GitHub OAuth handler ────────────────────────────────────────────────────
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

  // ── Back navigation ─────────────────────────────────────────────────────────
  const handleBackNavigation = useCallback(() => {
    if (!feedbackSubmitted) setShowExitModal(true);
    else router.back();
  }, [feedbackSubmitted, router, setShowExitModal]);

  // ── Render branches ─────────────────────────────────────────────────────────

  if (!isMounted || loading)
    return (
      <AnalyzeLoadingScreen
        repoUrl={repoUrl}
        source={source}
        loadingStep={loadingStep}
        loadingControls={loadingControls}
      />
    );

  if (error)
    return <AnalyzeErrorScreen error={error} isRateLimit={isRateLimit} />;

  if (!data) return null;

  if (showGitHubAuthModal)
    return <GitHubAuthModal onLogin={handleGitHubLogin} />;

  // ── Main layout ─────────────────────────────────────────────────────────────

  return (
    <div className="h-screen w-screen bg-[#0a0a0a] text-slate-200 overflow-hidden flex flex-col font-satoshi">
      <AnalyzeHeader
        data={data}
        source={source}
        isAiStreaming={isAiStreaming}
        feedbackSubmitted={feedbackSubmitted}
        hideFeedback={hideFeedback}
        onBack={handleBackNavigation}
        onFeedback={(isHelpful) => handleFeedback(isHelpful)}
      />

      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a]">
          <AnalyzeTabBar activeTab={activeTab} onTabChange={setActiveTab} />

          {/* Tab panels */}
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
                          <ArchitectureMap
                            dependencyGraph={data.dependencyGraph}
                            entryPoints={data.entryPoints}
                            fileMetrics={data.fileMetrics}
                          />
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
                <DoctorPanel
                  data={data}
                  source={source}
                  onOpenChat={() => setIsChatOpen(true)}
                />
              )}

              {activeTab === "risk_radar" && <RiskRadarPanel data={data} />}
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
              className="absolute right-0 bottom-8 z-40 flex items-center gap-3 bg-[#141414]/90 backdrop-blur-md border border-white/10 border-r-0 px-4 py-4 rounded-l-2xl shadow-[-10px_0_30px_rgba(0,0,0,0.5)] hover:bg-[#1a1a1a] hover:pr-6 transition-all group"
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

      <ExitModal
        isOpen={showExitModal}
        modalRef={exitModalRef}
        onFeedback={handleFeedback}
        onSkip={() => router.back()}
      />
    </div>
  );
});

AnalyzeContent.displayName = "AnalyzeContent";

// ─────────────────────────────────────────────────────────────────────────────

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
