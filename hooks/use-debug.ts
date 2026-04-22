import { useState } from "react";

interface DebugResult {
  root_cause_hypothesis: string;
  fix_suggestions: string[];
  verification_steps: string[];
  confidence: "high" | "medium" | "low";
  requires_runtime_check: boolean;
  highlighted_mermaid?: string;
  crash_node?: { file: string; line: number };
}

export function useDebugAnalysis(repoUrl: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DebugResult | null>(null);

  const analyzeCrash = async (stackTrace: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/debug/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl, stackTrace }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to analyze crash");
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return { analyzeCrash, result, isLoading, error, reset };
}