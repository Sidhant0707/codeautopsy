// lib/debug/graph-traversal.ts

import { DependencyGraph } from "@/lib/dependency-graph";
import { TraversalNode } from "./types";

interface TraversalConfig {
  maxDepth: number;
  maxNodes: number;
  prioritizeUpstream: boolean;
}

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
  const visited = new Set<string>();

  // Add crash site
  result.push({
    file: crashNode,
    distance: 0,
    fan_in: fanIn[crashNode] || 0,
    relationship: "crash_site",
    relevance_score: 1000, // Always highest priority
  });
  visited.add(crashNode);

  // BFS for downstream (what crash node imports)
  const downstreamNodes = bfsTraversal(
    crashNode,
    graph,
    fanIn,
    config.maxDepth,
    "downstream",
    visited
  );

  // BFS for upstream (who imports crash node)
  const upstreamNodes = bfsTraversal(
    crashNode,
    buildReverseGraph(graph),
    fanIn,
    config.maxDepth,
    "upstream",
    visited
  );

  result.push(...downstreamNodes, ...upstreamNodes);

  // Sort by relevance score (distance penalty × fan-in boost)
  result.sort((a, b) => b.relevance_score - a.relevance_score);

  // Limit to maxNodes
  return result.slice(0, config.maxNodes);
}

function bfsTraversal(
  startNode: string,
  graph: DependencyGraph,
  fanIn: Record<string, number>,
  maxDepth: number,
  relationship: "upstream" | "downstream",
  visited: Set<string>
): TraversalNode[] {
  const queue: { node: string; depth: number }[] = [
    { node: startNode, depth: 0 },
  ];
  const result: TraversalNode[] = [];

  while (queue.length > 0) {
    const { node, depth } = queue.shift()!;

    if (depth >= maxDepth) continue;

    const neighbors = graph[node] || [];

    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);

      const distance = depth + 1;
      const fanInScore = fanIn[neighbor] || 0;

      // Heuristic: Closer nodes + higher fan-in = more relevant
      // Formula: relevance = (maxDepth - distance) * (1 + log(fan_in + 1))
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

function buildReverseGraph(graph: DependencyGraph): DependencyGraph {
  const reverse: DependencyGraph = {};

  for (const [file, imports] of Object.entries(graph)) {
    for (const imp of imports) {
      if (!reverse[imp]) reverse[imp] = [];
      reverse[imp].push(file);
    }
  }

  return reverse;
}