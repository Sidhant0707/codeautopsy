// lib/debug/heuristics.ts

import { TraversalNode, CrashNode } from "./types";

export function applyDebugHeuristics(
  nodes: TraversalNode[],
  crashNode: CrashNode,
  errorType: string
): TraversalNode[] {
  return nodes.map((node) => {
    let bonus = 0;

    // Heuristic 1: Upstream nodes more likely to be root cause
    if (node.relationship === "upstream") {
      bonus += 2;
    }

    // Heuristic 2: Files with "config", "setup", "init" in name
    if (/config|setup|init|bootstrap|env/i.test(node.file)) {
      bonus += 1.5;
    }

    // Heuristic 3: Entry points are often misconfigured
    if (node.file.includes("index.") || node.file.includes("main.")) {
      bonus += 1;
    }

    // Heuristic 4: If crash is TypeError/ReferenceError, prioritize data sources
    if (
      (errorType === "TypeError" || errorType === "ReferenceError") &&
      (node.file.includes("api/") ||
        node.file.includes("service") ||
        node.file.includes("db") ||
        node.file.includes("database"))
    ) {
      bonus += 1.5;
    }

    // Heuristic 5: Auth-related errors should prioritize auth files
    if (
      errorType.toLowerCase().includes("auth") &&
      (node.file.includes("auth") ||
        node.file.includes("login") ||
        node.file.includes("session"))
    ) {
      bonus += 2;
    }

    // Heuristic 6: Middleware and route handlers are common error sources
    if (
      node.file.includes("middleware") ||
      node.file.includes("route") ||
      node.file.includes("handler")
    ) {
      bonus += 1;
    }

    return {
      ...node,
      relevance_score: node.relevance_score + bonus,
    };
  });
}

// Confidence scoring based on traversal results
export function calculateConfidence(
  traversalPath: TraversalNode[],
  crashNode: CrashNode
): "high" | "medium" | "low" {
  const upstreamCount = traversalPath.filter(
    (n) => n.relationship === "upstream"
  ).length;
  const highFanInCount = traversalPath.filter((n) => n.fan_in > 5).length;

  // High confidence: Multiple upstream nodes with high fan-in
  if (upstreamCount >= 3 && highFanInCount >= 2) {
    return "high";
  }

  // Medium confidence: Some upstream nodes
  if (upstreamCount >= 1) {
    return "medium";
  }

  // Low confidence: Only downstream or isolated crash
  return "low";
}

// Determine if error likely requires runtime check
export function requiresRuntimeCheck(
  errorType: string,
  errorMessage: string
): boolean {
  const runtimeIndicators = [
    /undefined/i,
    /null/i,
    /cannot read/i,
    /is not a function/i,
    /missing/i,
    /not found/i,
    /failed to fetch/i,
    /network/i,
    /timeout/i,
    /connection/i,
    /database/i,
    /authentication/i,
    /unauthorized/i,
  ];

  const fullText = `${errorType} ${errorMessage}`;

  return runtimeIndicators.some((pattern) => pattern.test(fullText));
}