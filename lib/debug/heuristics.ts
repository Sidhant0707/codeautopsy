// lib/debug/heuristics.ts

import { TraversalNode } from "./types";

// ── Debug heuristics ──────────────────────────────────────────────────────────
export function applyDebugHeuristics(
  nodes: TraversalNode[],
  errorType: string
): TraversalNode[] {
  return nodes.map((node) => {
    let bonus = 0;

    if (node.relationship === "upstream") bonus += 2;

    if (/config|setup|init|bootstrap|env/i.test(node.file)) bonus += 1.5;

    if (node.file.includes("index.") || node.file.includes("main.")) bonus += 1;

    if (
      (errorType === "TypeError" || errorType === "ReferenceError") &&
      (node.file.includes("api/") ||
        node.file.includes("service") ||
        node.file.includes("db") ||
        node.file.includes("database"))
    ) {
      bonus += 1.5;
    }

    if (
      errorType.toLowerCase().includes("auth") &&
      (node.file.includes("auth") ||
        node.file.includes("login") ||
        node.file.includes("session"))
    ) {
      bonus += 2;
    }

    if (
      node.file.includes("middleware") ||
      node.file.includes("route") ||
      node.file.includes("handler")
    ) {
      bonus += 1;
    }

    return { ...node, relevance_score: node.relevance_score + bonus };
  });
}

// ── Confidence ────────────────────────────────────────────────────────────────
// Confidence is derived from traversal quality only — NOT from the AI response,
// which previously generated a confidence value that was silently discarded.
export function calculateConfidence(
  traversalPath: TraversalNode[]
): "high" | "medium" | "low" {
  const total = traversalPath.length;

  // Not enough context to be confident
  if (total <= 1) return "low";

  const upstreamNodes = traversalPath.filter(
    (n) => n.relationship === "upstream"
  );
  const upstreamCount = upstreamNodes.length;

  const highFanInCount = traversalPath.filter((n) => n.fan_in > 5).length;

  // Score based on proportion, not fixed thresholds
  const upstreamRatio = upstreamCount / total;
  const fanInRatio = highFanInCount / total;

  if (upstreamRatio >= 0.3 && fanInRatio >= 0.2) return "high";
  if (upstreamCount >= 1) return "medium";
  return "low";
}

// ── Runtime check ─────────────────────────────────────────────────────────────
// Previously matched overly broad patterns like /undefined/ and /null/ which
// appear in nearly every TypeError, making this flag meaningless.
// Now targets patterns that specifically indicate runtime/external state issues.
export function requiresRuntimeCheck(
  errorType: string,
  errorMessage: string
): boolean {
  const runtimeIndicators = [
    /failed to fetch/i,
    /network error/i,
    /timeout/i,
    /connection refused/i,
    /ECONNREFUSED/,
    /database/i,
    /authentication failed/i,
    /unauthorized/i,
    /403/,
    /401/,
    /500/,
    /missing.*env/i,
    /env.*missing/i,
  ];

  const fullText = `${errorType} ${errorMessage}`;
  return runtimeIndicators.some((pattern) => pattern.test(fullText));
}