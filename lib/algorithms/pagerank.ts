// lib/algorithms/pagerank.ts

export interface PageRankOptions {
  dampingFactor?: number;   
  iterations?: number;      
  epsilon?: number;         
  weighted?: boolean;       
}

export interface PageRankResult {
  scores: Map<string, number>;          
  iterations: number;                   
  converged: boolean;                   
  dangling: Set<string>;           
  topK: (k: number) => [string, number][];
}


export type AdjacencyList = Map<string, Map<string, number>>;


export function computePageRank(
  graph: AdjacencyList,
  options: PageRankOptions = {}
): PageRankResult {
  const {
    dampingFactor = 0.85,
    iterations = 25,
    epsilon = 1e-6,
    weighted = true,
  } = options;

  const nodes = Array.from(graph.keys());
  const N = nodes.length;

  if (N === 0) {
    return {
      scores: new Map(),
      iterations: 0,
      converged: true,
      dangling: new Set(),
      topK: () => [],
    };
  }

  // --- Build reverse adjacency (who imports ME?) -------------------------
  // reverseGraph[v] = Map<u, w>  means u → v exists with weight w
  const reverseGraph = new Map<string, Map<string, number>>();
  const outWeightSum = new Map<string, number>(); // Σ weights of outgoing edges

  for (const node of nodes) {
    if (!reverseGraph.has(node)) reverseGraph.set(node, new Map());
    const edges = graph.get(node)!;
    let total = 0;
    for (const [target, w] of edges) {
      total += weighted ? w : 1;
      if (!reverseGraph.has(target)) reverseGraph.set(target, new Map());
      reverseGraph.get(target)!.set(node, weighted ? w : 1);
    }
    outWeightSum.set(node, total);
  }

  // Ensure every node from reverseGraph is in our nodes set
  // (handles targets that were never listed as sources)
  const allNodes = Array.from(reverseGraph.keys());
  const nodeSet = new Set(allNodes);
  const n = nodeSet.size;

  // Dangling nodes: no outgoing edges
  const dangling = new Set<string>();
  for (const node of allNodes) {
    if ((outWeightSum.get(node) ?? 0) === 0) dangling.add(node);
  }

  // --- Initialise rank vector -------------------------------------------
  let rank = new Map<string, number>();
  const init = 1 / n;
  for (const node of allNodes) rank.set(node, init);

  const teleport = (1 - dampingFactor) / n;
  let actualIterations = 0;
  let converged = false;

  // --- Power iteration ---------------------------------------------------
  for (let iter = 0; iter < iterations; iter++) {
    actualIterations++;

    // Dangling node mass → distribute uniformly
    let danglingMass = 0;
    for (const d of dangling) danglingMass += rank.get(d)!;
    const danglingContrib = (dampingFactor * danglingMass) / n;

    const next = new Map<string, number>();

    for (const node of allNodes) {
      let sum = 0;
      const inbound = reverseGraph.get(node)!;
      for (const [src, w] of inbound) {
        const srcOut = outWeightSum.get(src) ?? 0;
        if (srcOut > 0) sum += (rank.get(src)! * w) / srcOut;
      }
      next.set(node, teleport + danglingContrib + dampingFactor * sum);
    }

    // L1 norm convergence check
    let delta = 0;
    for (const node of allNodes) {
      delta += Math.abs(next.get(node)! - rank.get(node)!);
    }

    rank = next;

    if (delta < epsilon) {
      converged = true;
      break;
    }
  }

  // --- Normalise to [0, 1] against the max rank -------------------------
  const maxRank = Math.max(...rank.values());
  const scores = new Map<string, number>();
  for (const [node, r] of rank) {
    scores.set(node, maxRank > 0 ? r / maxRank : 0);
  }

  const topK = (k: number): [string, number][] =>
    Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, k);

  return { scores, iterations: actualIterations, converged, dangling, topK };
}

/**
 * Maps a normalised PageRank score ∈ [0, 1] to an OKLCH heatmap colour.
 * Cold (low rank) → blue. Hot (high rank) → red, via cyan → green → yellow.
 * OKLCH gives perceptually uniform lightness across the hue sweep.
 */
export function rankToOklch(score: number): string {
  // Hue sweep: 264° (blue) → 0°/360° (red) over the score range
  const hue = 264 - score * 264;
  const chroma = 0.12 + score * 0.18;      // saturate as rank increases
  const lightness = 0.55 + score * 0.2;    // brighten hot nodes
  return `oklch(${lightness.toFixed(3)} ${chroma.toFixed(3)} ${hue.toFixed(1)})`;
}

/**
 * Derive a border-glow intensity string for React Flow node styles.
 * High-rank nodes get a pronounced box-shadow; low-rank nodes get none.
 */
export function rankToGlowStyle(score: number, color: string): React.CSSProperties {
  if (score < 0.1) return {};
  const blur = Math.round(4 + score * 28);
  const spread = Math.round(score * 6);
  return {
    boxShadow: `0 0 ${blur}px ${spread}px ${color}`,
    borderColor: color,
  };
}