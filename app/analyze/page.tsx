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

              {activeTab === "visualizer" && (
                <VisualizerPanel
                  data={data}
                  mapView={mapView}
                  onMapViewChange={setMapView}
                />
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

        <ChatPanel
          data={data}
          isOpen={isChatOpen}
          onOpen={() => setIsChatOpen(true)}
          onClose={() => setIsChatOpen(false)}
        />
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
