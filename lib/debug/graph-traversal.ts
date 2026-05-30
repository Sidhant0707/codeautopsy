// lib/debug/graph-traversal.ts

import { DependencyGraph } from "@/lib/dependency-graph";
import { TraversalNode } from "./types";

interface TraversalConfig {
  maxDepth: number;
  maxNodes: number;
  prioritizeUpstream: boolean;
}

// ── Reverse graph cache ───────────────────────────────────────────────────────
// Previously: buildReverseGraph() was called on every request,
// rebuilding the full reverse graph each time.
// Now: memoized per graph reference — rebuilt only when graph changes.
const reverseGraphCache = new WeakMap<DependencyGraph, DependencyGraph>();

function getOrBuildReverseGraph(graph: DependencyGraph): DependencyGraph {
  if (reverseGraphCache.has(graph)) {
    return reverseGraphCache.get(graph)!;
  }

  const reverse: DependencyGraph = {};
  for (const [file, imports] of Object.entries(graph)) {
    for (const imp of imports) {
      if (!reverse[imp]) reverse[imp] = [];
      reverse[imp].push(file);
    }
  }

  reverseGraphCache.set(graph, reverse);
  return reverse;
}

// ── Main traversal ────────────────────────────────────────────────────────────
export function traverseFromCrash(
  crashNode: string,
  graph: DependencyGraph,
  fanIn: Record<string, number>,
  config: TraversalConfig = {
    maxDepth: 3,
    maxNodes: 15,
    prioritizeUpstream: true,
  }
): TraversalNode[] {
  const result: TraversalNode[] = [];

  // Separate visited sets per direction so upstream traversal
  // is not blocked by nodes already visited during downstream traversal.
  const visitedDownstream = new Set<string>([crashNode]);
  const visitedUpstream = new Set<string>([crashNode]);

  result.push({
    file: crashNode,
    distance: 0,
    fan_in: fanIn[crashNode] || 0,
    relationship: "crash_site",
    relevance_score: 1000,
  });

  const downstreamNodes = bfsTraversal(
    crashNode,
    graph,
    fanIn,
    config.maxDepth,
    "downstream",
    visitedDownstream
  );

  const reverseGraph = getOrBuildReverseGraph(graph);

  const upstreamNodes = bfsTraversal(
    crashNode,
    reverseGraph,
    fanIn,
    config.maxDepth,
    "upstream",
    visitedUpstream
  );

  result.push(...downstreamNodes, ...upstreamNodes);

  result.sort((a, b) => b.relevance_score - a.relevance_score);

  return result.slice(0, config.maxNodes);
}

// ── BFS ───────────────────────────────────────────────────────────────────────
function bfsTraversal(
  startNode: string,
  graph: DependencyGraph,
  fanIn: Record<string, number>,
  maxDepth: number,
  relationship: "upstream" | "downstream",
  visited: Set<string>
): TraversalNode[] {
  // Using an index pointer instead of array.shift() avoids O(n)
  // dequeue cost on large graphs.
  const queue: { node: string; depth: number }[] = [
    { node: startNode, depth: 0 },
  ];
  let head = 0;
  const result: TraversalNode[] = [];

  while (head < queue.length) {
    const { node, depth } = queue[head++];

    if (depth >= maxDepth) continue;

    const neighbors = graph[node] || [];

    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);

      const distance = depth + 1;
      const fanInScore = fanIn[neighbor] || 0;

      const relevance_score =
        (maxDepth - distance) * (1 + Math.log(fanInScore + 1));

      result.push({
        file: neighbor,
        distance,
        fan_in: fanInScore,
        relationship,
        relevance_score,
      });

      queue.push({ node: neighbor, depth: distance });
    }
  }

  return result;
}