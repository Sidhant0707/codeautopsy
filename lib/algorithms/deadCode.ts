// lib/algorithms/deadCode.ts

export interface DeadCodeResult {
  reachable: Set<string>;
  unreachable: string[];
  unreachableByDirectory: Record<string, string[]>;
  reachabilityScore: number; // % of codebase reachable
}

export function computeDeadCode(
  graph: Record<string, string[]>,
  entryPoints: string[],
): DeadCodeResult {
  const allNodes = Object.keys(graph);

  if (allNodes.length === 0 || entryPoints.length === 0) {
    return {
      reachable: new Set(),
      unreachable: allNodes,
      unreachableByDirectory: groupByDirectory(allNodes),
      reachabilityScore: 0,
    };
  }

  // BFS from all entry points through directed dependency graph
  const reachable = new Set<string>();
  const queue = [...entryPoints];

  for (const ep of entryPoints) reachable.add(ep);

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const dep of graph[cur] || []) {
      if (!reachable.has(dep)) {
        reachable.add(dep);
        queue.push(dep);
      }
    }
  }

  const unreachable = allNodes.filter((n) => !reachable.has(n));
  const reachabilityScore =
    allNodes.length > 0 ? (reachable.size / allNodes.length) * 100 : 100;

  return {
    reachable,
    unreachable,
    unreachableByDirectory: groupByDirectory(unreachable),
    reachabilityScore,
  };
}

function groupByDirectory(paths: string[]): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const p of paths) {
    const parts = p.split("/");
    const dir = parts.length > 1 ? parts.slice(0, -1).join("/") : "(root)";
    if (!map[dir]) map[dir] = [];
    map[dir].push(p);
  }
  return map;
}