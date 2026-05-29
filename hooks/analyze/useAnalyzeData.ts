"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { RepoData, Analysis } from "@/lib/types/analyze";
import { useAiStream } from "./useAiStream";
import { DEFAULT_ANALYSIS } from "@/components/analyze/constants";

interface UseAnalyzeDataOptions {
  repoUrl: string | null;
  source: string | null;
  onRequireGitHubAuth: () => void;
}

interface UseAnalyzeDataReturn {
  /** Fully resolved data, with AI analysis injected (streaming or cached). */
  data: RepoData | null;
  loading: boolean;
  error: string | null;
  isRateLimit: boolean;
  isAiStreaming: boolean;
  aiGateState: "free" | "login-required" | "limit-reached" | null;
}

/**
 * Owns all data-fetching concerns for the analyze page.
 *
 * Responsibilities:
 * - SWR-cached remote fetch via `/api/analyze`
 * - Local-upload fallback from `sessionStorage`
 * - AI stream injection via `useAiStream`
 * - Unified `data`, `loading`, and `error` surface for consumers
 *
 * The `onRequireGitHubAuth` callback is fired instead of surfacing an error
 * string when the API returns `REQUIRE_GITHUB_AUTH`, so the caller can show
 * the auth modal without coupling this hook to UI state.
 */
export function useAnalyzeData({
  repoUrl,
  source,
  onRequireGitHubAuth,
}: UseAnalyzeDataOptions): UseAnalyzeDataReturn {
  const isLocal = source === "local";

  // ─── Local Upload Path ──────────────────────────────────────────────────────
  // Read once on mount. We use plain `useState` initializers (not effects) so
  // the value is available synchronously on the first render.

  const [localData] = useState<RepoData | null>(() => {
    if (typeof window === "undefined" || !isLocal) return null;
    const stored = sessionStorage.getItem("localAnalysisResult");
    return stored ? (JSON.parse(stored) as RepoData) : null;
  });

  const [localError] = useState<string | null>(() => {
    if (typeof window === "undefined" || !isLocal) return null;
    const stored = sessionStorage.getItem("localAnalysisResult");
    return !stored
      ? "Local analysis data expired or lost. Please return to home and upload again."
      : null;
  });

  // ─── Remote Fetch Path (SWR) ────────────────────────────────────────────────

  const {
    data: swrData,
    error: swrError,
    isLoading: swrLoading,
  } = useSWR(
    repoUrl && !isLocal ? ["/api/analyze", repoUrl] : null,
    ([url, repo]) => fetcher(url, repo),
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
      onError: (err: Error) => {
        if (err.message === "REQUIRE_GITHUB_AUTH") onRequireGitHubAuth();
      },
    },
  );

  // ─── AI Stream ──────────────────────────────────────────────────────────────
  // Pass swrData to the stream hook. It self-guards and will only open a
  // stream when `swrData.analysis === null`.

  const { aiAnalysis, isAiStreaming, aiGateState } = useAiStream( 
    isLocal ? null : swrData,
  );

  // ─── Unified Data Surface ───────────────────────────────────────────────────

  const data = useMemo<RepoData | null>(() => {
    if (isLocal) return localData;
    if (!swrData || swrError) return null;

    // The server may return `analysis: null` to signal client-side streaming.
    // We inject the live aiAnalysis (or a safe placeholder skeleton) so the
    // rest of the UI never needs to handle a null analysis field.
    const resolvedAnalysis: Analysis =
      aiAnalysis != null
        ? (aiAnalysis as unknown as Analysis)
        : swrData.analysis !== null
          ? swrData.analysis
          : (DEFAULT_ANALYSIS as unknown as Analysis);

    return {
      ...swrData,
      analysis: resolvedAnalysis,
    } as RepoData;
  }, [isLocal, localData, swrData, swrError, aiAnalysis]);

  // ─── Error Derivation ───────────────────────────────────────────────────────
  // Strip the REQUIRE_GITHUB_AUTH sentinel — that path is handled via the
  // callback above and should not surface as a visible error string.

  const rawErrorMessage =
    swrError?.message === "REQUIRE_GITHUB_AUTH" ? null : swrError?.message;

  const error: string | null = isLocal
    ? localError
    : (rawErrorMessage ?? null);

  const isRateLimit =
    !!error &&
    (error.includes("RATE_LIMIT_REACHED") || error.includes("Daily limit"));

  // ─── Loading ─────────────────────────────────────────────────────────────────

  const loading = isLocal ? !localData && !localError : swrLoading;

  return {
    data,
    loading,
    error,
    isRateLimit,
    isAiStreaming,
    aiGateState: isLocal ? null : aiGateState === "auth_required"
      ? "login-required"
      : aiGateState === "limit_reached"
        ? "limit-reached"
        : "free",
  };
}