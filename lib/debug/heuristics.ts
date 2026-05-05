

import { TraversalNode } from "./types";

export function applyDebugHeuristics(
  nodes: TraversalNode[],
  errorType: string
): TraversalNode[] {
  return nodes.map((node) => {
    let bonus = 0;

    
    if (node.relationship === "upstream") {
      bonus += 2;
    }

    
    if (/config|setup|init|bootstrap|env/i.test(node.file)) {
      bonus += 1.5;
    }

    
    if (node.file.includes("index.") || node.file.includes("main.")) {
      bonus += 1;
    }

    
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

    return {
      ...node,
      relevance_score: node.relevance_score + bonus,
    };
  });
}


export function calculateConfidence(
  traversalPath: TraversalNode[],
): "high" | "medium" | "low" {
  const upstreamCount = traversalPath.filter(
    (n) => n.relationship === "upstream"
  ).length;
  const highFanInCount = traversalPath.filter((n) => n.fan_in > 5).length;

  
  if (upstreamCount >= 3 && highFanInCount >= 2) {
    return "high";
  }

  
  if (upstreamCount >= 1) {
    return "medium";
  }

  
  return "low";
}


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