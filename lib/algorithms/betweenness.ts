// lib/algorithms/betweenness.ts
//
// Brandes' algorithm for betweenness centrality on a directed graph.
// O(V * E) time, O(V + E) space — the best known exact algorithm for
// unweighted graphs. No external library required; matches the interface
// style of pagerank.ts and articulationPoints.ts already in this codebase.
//
// Betweenness centrality of node v =
//   Σ (s ≠ v ≠ t) [ σ(s,t|v) / σ(s,t) ]
// where σ(s,t) is the number of shortest paths from s to t,
// and σ(s,t|v) is the subset of those paths passing through v.
//
// In CodeAutopsy terms: a file with high betweenness sits on many
// shortest import chains between other files. Removing or breaking it
// disrupts the maximum number of indirect dependency paths — making it
// a higher-priority refactor/review target than fan-in or PageRank alone
// can identify.

export interface BetweennessResult {
  scores: Map<string, number>;
  topK: (k: number) => Array<[string, number]>;
  normalized: boolean;
}

/**
 * Compute betweenness centrality for every node in a directed dependency graph.
 *
 * @param graph       Adjacency list: graph[A] = [B, C] means A imports B and C.
 * @param normalize   When true, divide each score by (N-1)(N-2) so all scores
 *                    fall in [0, 1] regardless of graph size. Default: true.
 */
export function computeBetweenness(
  graph: Record<string, string[]>,
  normalize = true,
): BetweennessResult {
  // ── 0. Fast path ──────────────────────────────────────────────────────────
  const nodeSet = new Set<string>();
  for (const [src, targets] of Object.entries(graph)) {
    nodeSet.add(src);
    for (const t of targets) nodeSet.add(t);
  }

  const nodes = Array.from(nodeSet);
  const N = nodes.length;

  const empty: BetweennessResult = {
    scores: new Map(),
    topK: () => [],
    normalized: normalize,
  };

  if (N < 3) return empty;

  const nodeIndex = new Map<string, number>(nodes.map((n, i) => [n, i]));

  // Build numeric adjacency list for O(1) index lookups
  const adj: number[][] = Array.from({ length: N }, () => []);
  for (const [src, targets] of Object.entries(graph)) {
    const u = nodeIndex.get(src);
    if (u === undefined) continue;
    for (const t of targets) {
      const v = nodeIndex.get(t);
      if (v !== undefined && v !== u) adj[u].push(v);
    }
  }

  // ── 1. Brandes' algorithm ─────────────────────────────────────────────────
  const cb = new Float64Array(N); // accumulator for centrality

  // BFS queue and per-source arrays — allocated once and reused each source
  const bfsQueue = new Int32Array(N);
  const sigma    = new Float64Array(N); // shortest-path counts from source s
  const dist     = new Int32Array(N);   // shortest-path distances from s
  const delta    = new Float64Array(N); // dependency accumulator

  // Stack of nodes in order of non-increasing distance from s
  // (used for back-propagation)
  const stack: number[] = [];

  // Predecessor lists: pred[v] = nodes on shortest paths to v from s
  const pred: number[][] = Array.from({ length: N }, () => []);

  for (let s = 0; s < N; s++) {
    // Reset per-source state
    stack.length = 0;
    for (let i = 0; i < N; i++) {
      pred[i].length = 0;
      sigma[i]       = 0;
      dist[i]        = -1;
      delta[i]       = 0;
    }
    sigma[s] = 1;
    dist[s]  = 0;

    // BFS from s
    let head = 0;
    let tail = 0;
    bfsQueue[tail++] = s;

    while (head < tail) {
      const v = bfsQueue[head++];
      stack.push(v);

      for (const w of adj[v]) {
        // First discovery of w from s
        if (dist[w] < 0) {
          bfsQueue[tail++] = w;
          dist[w]          = dist[v] + 1;
        }
        // Shortest path to w via v
        if (dist[w] === dist[v] + 1) {
          sigma[w] += sigma[v];
          pred[w].push(v);
        }
      }
    }

    // Back-propagation: accumulate pair dependencies
    while (stack.length > 0) {
      const w = stack.pop()!;
      for (const v of pred[w]) {
        delta[v] += (sigma[v] / sigma[w]) * (1 + delta[w]);
      }
      if (w !== s) cb[w] += delta[w];
    }
  }

  // ── 2. Normalization ──────────────────────────────────────────────────────
  const normFactor = normalize && N > 2 ? 1 / ((N - 1) * (N - 2)) : 1;

  const scores = new Map<string, number>();
  for (let i = 0; i < N; i++) {
    scores.set(nodes[i], cb[i] * normFactor);
  }

  const topK = (k: number): Array<[string, number]> =>
    Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, k);

  return { scores, topK, normalized: normalize };
}

/**
 * Maps a normalized betweenness score [0, 1] to a severity label.
 * Used for badge rendering in ArchitectureMap node overlays.
 */
export function betweennessToSeverity(
  score: number,
): "critical" | "high" | "medium" | "low" {
  if (score >= 0.15) return "critical";
  if (score >= 0.07) return "high";
  if (score >= 0.01) return "medium";
  return "low";
}

/**
 * Severity → Tailwind border color class for node highlighting.
 * Consistent with the heatmap convention used in rankToOklch (pagerank.ts).
 */
export const BETWEENNESS_SEVERITY_COLORS: Record<
  ReturnType<typeof betweennessToSeverity>,
  string
> = {
  critical: "#ef4444", // red-500
  high:     "#f97316", // orange-500
  medium:   "#eab308", // yellow-500
  low:      "#3b82f6", // blue-500
};