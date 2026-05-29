"use client";

import { useState, useEffect } from "react";
import { RepoData } from "@/lib/types/analyze";

// The subset of swrData fields that the AI endpoint consumes.
// Keeps the hook signature explicit and avoids a full RepoData dependency.
interface AiStreamInput {
  owner: string;
  repo: string;
  description: string;
  entryPoints: string[];
  topFilesForGroq?: unknown;
  fileContents?: { path: string; content: string }[];
  blastRadiusTargets?: unknown;
  healthMetrics?: unknown;
  // analysis is null when the server deferred AI generation to the client stream
  analysis: RepoData["analysis"] | null;
}

interface UseAiStreamReturn {
  aiAnalysis: Record<string, unknown> | null;
  isAiStreaming: boolean;
}

/**
 * Owns the real-time AI streaming engine.
 *
 * When `swrData.analysis` comes back as `null`, the server has signalled that
 * the AI generation should be streamed client-side. This hook opens a POST
 * stream to `/api/ai`, reads NDJSON chunks, and applies on-the-fly partial
 * JSON repair so the UI can render progressive updates before the stream
 * completes.
 *
 * The hook is intentionally idempotent: once streaming has started (or
 * completed), it will not re-trigger for the same `swrData` reference.
 */
export function useAiStream(
  swrData: AiStreamInput | null | undefined,
): UseAiStreamReturn {
  const [aiAnalysis, setAiAnalysis] = useState<Record<string, unknown> | null>(
    null,
  );
  const [isAiStreaming, setIsAiStreaming] = useState(false);

  useEffect(() => {
    // Only start the stream when:
    // 1. swrData has arrived
    // 2. The server explicitly deferred analysis (analysis === null)
    // 3. We are not already streaming
    // 4. We have not already received a completed result
    if (!swrData || swrData.analysis !== null || isAiStreaming || aiAnalysis) {
      return;
    }

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

          // 1. Attempt to parse the complete accumulated JSON first.
          try {
            setAiAnalysis(JSON.parse(jsonText));
          } catch {
            // 2. On-the-fly partial JSON repair for progressive UI rendering.
            //    The incoming stream is valid JSON that may be mid-write, so we
            //    close any open string literals and balance braces/brackets.
            try {
              let fixed = jsonText.replace(/("[^"]*)$/, '"');

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
              // Silently wait for the next chunk if the fragment is still
              // unparseable after repair attempts.
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
  // Intentionally omitting `isAiStreaming` and `aiAnalysis` from deps:
  // the guard conditions at the top of the effect body are sufficient, and
  // including them would risk re-triggering the stream on state updates.

  return { aiAnalysis, isAiStreaming };
}