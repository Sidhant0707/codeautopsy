// lib/algorithms/articulationPoints.ts

export interface ArticulationPointResult {
  articulationPoints: Set<string>;
  bridges: Array<[string, string]>;
  componentSizes: Map<string, number>; 
}

export function computeArticulationPoints(
  graph: Record<string, string[]>,
): ArticulationPointResult {
  const nodes = Object.keys(graph);
  if (nodes.length === 0) {
    return {
      articulationPoints: new Set(),
      bridges: [],
      componentSizes: new Map(),
    };
  }

  // Build undirected adjacency for AP detection
  const adj = new Map<string, Set<string>>();
  for (const node of nodes) {
    if (!adj.has(node)) adj.set(node, new Set());
    for (const dep of graph[node] || []) {
      if (!adj.has(dep)) adj.set(dep, new Set());
      adj.get(node)!.add(dep);
      adj.get(dep)!.add(node);
    }
  }

  const allNodes = Array.from(adj.keys());
  const visited = new Set<string>();
  const disc = new Map<string, number>(); // discovery time
  const low = new Map<string, number>();  // lowest discovery reachable
  const parent = new Map<string, string | null>();
  const aps = new Set<string>();
  const bridges: Array<[string, string]> = [];
  let timer = 0;

  const dfs = (u: string) => {
    visited.add(u);
    disc.set(u, timer);
    low.set(u, timer);
    timer++;

    let childCount = 0;

    for (const v of adj.get(u) || []) {
      if (!visited.has(v)) {
        childCount++;
        parent.set(v, u);
        dfs(v);

        low.set(u, Math.min(low.get(u)!, low.get(v)!));

        // AP condition 1: u is root with 2+ children
        if (parent.get(u) === null && childCount > 1) aps.add(u);

        // AP condition 2: u is not root and low[v] >= disc[u]
        if (parent.get(u) !== null && low.get(v)! >= disc.get(u)!) aps.add(u);

        // Bridge condition
        if (low.get(v)! > disc.get(u)!) bridges.push([u, v]);
      } else if (v !== parent.get(u)) {
        low.set(u, Math.min(low.get(u)!, disc.get(v)!));
      }
    }
  };

  for (const node of allNodes) {
    if (!visited.has(node)) {
      parent.set(node, null);
      dfs(node);
    }
  }

  // For each AP, estimate how many nodes become disconnected if removed
  const componentSizes = new Map<string, number>();
  for (const ap of aps) {
    // BFS without the AP node to count disconnected components
    const remaining = new Set(allNodes.filter((n) => n !== ap));
    const neighbors = Array.from(adj.get(ap) || []).filter((n) =>
      remaining.has(n),
    );

    let maxDisconnected = 0;
    const seen = new Set<string>();

    for (const start of neighbors) {
      if (seen.has(start)) continue;
      const queue = [start];
      seen.add(start);
      let count = 0;
      while (queue.length > 0) {
        const cur = queue.shift()!;
        count++;
        for (const nb of adj.get(cur) || []) {
          if (!seen.has(nb) && remaining.has(nb)) {
            seen.add(nb);
            queue.push(nb);
          }
        }
      }
      maxDisconnected = Math.max(maxDisconnected, count);
    }

    componentSizes.set(ap, maxDisconnected);
  }

  return { articulationPoints: aps, bridges, componentSizes };
}