"use client";

import { useState, useEffect } from "react";
import { RepoData } from "@/lib/types/analyze";

interface AiStreamInput {
  owner: string;
  repo: string;
  description: string;
  entryPoints: string[];
  topFilesForGroq?: unknown;
  fileContents?: { path: string; content: string }[];
  blastRadiusTargets?: unknown;
  healthMetrics?: unknown;
  analysis: RepoData["analysis"] | null;
}

// Gate states the UI needs to react to
export type AiGateState = "auth_required" | "limit_reached" | null;

interface UseAiStreamReturn {
  aiAnalysis: Record<string, unknown> | null;
  isAiStreaming: boolean;
  aiGateState: AiGateState;
}

export function useAiStream(
  swrData: AiStreamInput | null | undefined,
): UseAiStreamReturn {
  const [aiAnalysis, setAiAnalysis] = useState<Record<string, unknown> | null>(null);
  const [isAiStreaming, setIsAiStreaming] = useState(false);
  const [aiGateState, setAiGateState] = useState<AiGateState>(null);

  useEffect(() => {
    if (!swrData || swrData.analysis !== null || isAiStreaming || aiAnalysis) {
      return;
    }

    // Don't retry if we already know the gate is closed
    if (aiGateState) return;

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

        // ── Handle gate responses ───────────────────────────────────────────
        if (res.status === 401) {
          setAiGateState("auth_required");
          return;
        }

        if (res.status === 402) {
          setAiGateState("limit_reached");
          return;
        }

        if (!res.ok || !res.body) return;

        // ── Stream processing (unchanged) ───────────────────────────────────
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let jsonText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          jsonText += decoder.decode(value, { stream: true });

          try {
            setAiAnalysis(JSON.parse(jsonText));
          } catch {
            try {
              let fixed = jsonText.replace(/("[^"]*)$/, '"');
              const openBraces   = (fixed.match(/\{/g) || []).length;
              const closeBraces  = (fixed.match(/\}/g) || []).length;
              const openBrackets = (fixed.match(/\[/g) || []).length;
              const closeBrackets = (fixed.match(/\]/g) || []).length;

              fixed +=
                "]".repeat(Math.max(0, openBrackets - closeBrackets)) +
                "}".repeat(Math.max(0, openBraces - closeBraces));

              const partial = JSON.parse(fixed);
              if (partial) setAiAnalysis(partial);
            } catch {
              // Wait for next chunk
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swrData]);

  return { aiAnalysis, isAiStreaming, aiGateState };
}