/**
 * Articulation Point & Bridge Detection — Single Points of Failure
 *
 * Identifies structural vulnerabilities in the directed dependency graph by
 * analysing the underlying undirected topology.
 *
 * ── Definitions ──────────────────────────────────────────────────────────────
 *
 *   Articulation Point (AP)
 *     A vertex whose removal increases the number of connected components.
 *     CodeAutopsy interpretation: a file that, if deleted or fatally broken,
 *     splits the codebase into disconnected islands.
 *
 *   Bridge
 *     An edge whose removal increases the number of connected components.
 *     CodeAutopsy interpretation: a single import relationship with no
 *     alternative path around it — severing it severs the graph.
 *
 * ── Mathematical basis: Tarjan (1972) ────────────────────────────────────────
 *
 *   disc[u]  Discovery time of vertex u in the DFS traversal.
 *   low[u]   Minimum disc value reachable from u's DFS subtree via ≤1 back-edge.
 *
 *   Non-root AP:  ∃ DFS child v of u  s.t.  low[v] >= disc[u]
 *   Root AP:      DFS-tree root with ≥ 2 independent subtree children
 *   Bridge (u,v): low[v] > disc[u]  where v is a DFS-tree child of u
 *
 * ── Engineering decisions ────────────────────────────────────────────────────
 *
 *   1. ITERATIVE DFS
 *      V8's call stack saturates at ~10k–15k frames. Recursive Tarjan will
 *      throw "Maximum call stack size exceeded" on any large monorepo.
 *      An explicit DFSFrame stack is semantically equivalent and safe at
 *      any graph depth.
 *
 *   2. EDGE-ID PARENT TRACKING (not node-index tracking)
 *      The classic "skip the parent node" heuristic silently breaks for mutual
 *      imports (A→B and B→A both present). Using a per-edge integer ID means
 *      only the exact arrival edge is skipped; the second undirected edge from
 *      the mutual import is correctly processed as a back-edge, proving the
 *      A–B pair is not a bridge and neither node is a false AP.
 *
 *   3. DIRECTED-EDGE DEDUPLICATION
 *      Duplicate import statements (same target twice in one file) would create
 *      a false multi-edge, incorrectly suppressing bridge detection. A packed-
 *      integer Set (u × N + v) collapses identical directed edges in O(1).
 *
 *   4. O(1) BFS QUEUE (head-pointer index)
 *      Array.shift() is O(n) — it copies every remaining element one slot.
 *      The component-size BFS uses a monotonically advancing head index into a
 *      plain array, reducing dequeue cost to O(1) amortised.
 *
 *   5. TYPED-ARRAY SEEN-TRACKING
 *      Uint8Array over a plain boolean[] or Set<number> for the BFS visited
 *      state. V8 maps Uint8Array to a contiguous byte buffer; fill(0) compiles
 *      to a single memset call — reset cost between AP iterations is negligible.
 *
 * Complexity: O(V + E) — main algorithm (Tarjan)
 *             O(V + E) — component-size pass (amortised across all APs)
 */

// ── Public types ──────────────────────────────────────────────────────────────

/**
 * The complete result of the articulation-point analysis.
 */
export interface ArticulationPointResult {
  /**
   * File paths that are structural single points of failure.
   *
   * Stored as a `Set` for O(1) membership checks — the dominant use-case
   * when decorating thousands of React Flow nodes in a render pass:
   * `if (articulationPoints.has(node.id)) { ... }`.
   */
  articulationPoints: Set<string>;

  /**
   * Directed import edges whose removal disconnects the graph.
   *
   * Each tuple `[source, target]` preserves the original dependency-graph
   * direction: `source` imports `target`, and that specific import is the
   * sole structural connection between their respective components.
   */
  bridges: Array<[string, string]>;

  /**
   * For each articulation point, the node-count of the *largest* component
   * that fragments off when it is removed.
   *
   * Use this to rank AP severity in the UI: an AP that disconnects 800 files
   * is categorically more critical than one that disconnects 3.
   *
   * UI label should read "X files affected" — not "X components" — since
   * this value is a file count, not a component count.
   */
  componentSizes: Map<string, number>;
}

/**
 * A single articulation point with its pre-computed severity rank.
 * Returned by `getRankedArticulationPoints` for direct UI consumption.
 */
export interface RankedArticulationPoint {
  /** Absolute file path of the articulation point. */
  path: string;
  /**
   * Number of nodes in the largest fragment that splits off on removal.
   * Higher = more severe.
   */
  disconnects: number;
}

// ── Internal types ────────────────────────────────────────────────────────────

/** Single entry in the undirected adjacency list. */
interface AdjEntry {
  readonly v: number;
  /**
   * Unique integer ID of the undirected edge.
   * Both endpoints share this ID — used for parent-edge exclusion
   * instead of node-index comparison.
   */
  readonly edgeId: number;
}

/**
 * One frame on the explicit DFS call stack.
 * Mirrors a single recursive invocation of dfs(u).
 * `adjIdx` and `children` are mutated in-place as the frame is processed.
 */
interface DFSFrame {
  readonly u: number;
  /**
   * Edge ID on which we arrived at `u`.
   * `-1` for the DFS-forest root of each connected component.
   */
  readonly parentEdgeId: number;
  /** Cursor into `adj[u]` — resumed on re-entry after a child returns. */
  adjIdx: number;
  /**
   * DFS-tree child count. Only meaningful for component roots
   * (root AP check: children >= 2).
   */
  children: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function emptyResult(): ArticulationPointResult {
  return {
    articulationPoints: new Set(),
    bridges: [],
    componentSizes: new Map(),
  };
}

// ── Core algorithm ────────────────────────────────────────────────────────────

/**
 * Finds every articulation point, bridge, and per-AP component-size in the
 * underlying undirected topology of a directed dependency graph.
 *
 * @param dependencyGraph  `graph[A] = [B, C]` means file A imports files B and C.
 * @returns                Deduplicated sets of APs, bridges, and severity sizes.
 */
export function computeArticulationPoints(
  dependencyGraph: Record<string, string[]>,
): ArticulationPointResult {
  // ── 0. Fast path ──────────────────────────────────────────────────────────
  if (Object.keys(dependencyGraph).length === 0) return emptyResult();

  // ── 1. Enumerate all vertices ─────────────────────────────────────────────
  // Include import targets that are not graph keys (leaf files with no
  // outgoing imports) so the undirected graph is topologically complete.
  const nodeSet = new Set<string>(Object.keys(dependencyGraph));
  for (const targets of Object.values(dependencyGraph)) {
    for (const t of targets) {
      if (t) nodeSet.add(t);
    }
  }

  const nodes  = Array.from(nodeSet);
  const nodeId = new Map<string, number>(nodes.map((n, i) => [n, i] as const));
  const N      = nodes.length;

  if (N === 0) return emptyResult();

  // ── 2. Build undirected adjacency list with edge IDs ──────────────────────
  //
  // Each unique directed edge A→B becomes ONE undirected edge registered in
  // both adj[A] and adj[B] under the same integer edgeId.
  //
  // Deduplication key: ordered pair (u, v) packed as (u × N + v).
  //   Duplicate import statements  → same key → collapsed to one edge.
  //   A→B and B→A (mutual imports) → different keys → two separate edges,
  //   which correctly prevents false bridge / false AP detection.
  //
  // edgeOrigin[eid] = [directedSrc, directedTgt] preserves the original
  // arrow direction for accurate bridge-tuple reporting.

  const adj        : AdjEntry[][]      = Array.from({ length: N }, () => []);
  const edgeOrigin : [number, number][] = [];
  const seenEdges  = new Set<number>();

  for (const [source, targets] of Object.entries(dependencyGraph)) {
    const u = nodeId.get(source);
    if (u === undefined) continue;

    for (const target of targets) {
      if (!target) continue;

      const v = nodeId.get(target);
      if (v === undefined || u === v) continue; // guard + self-loop elimination

      const packed = u * N + v;
      if (seenEdges.has(packed)) continue;
      seenEdges.add(packed);

      const eid = edgeOrigin.length;
      edgeOrigin.push([u, v]);
      adj[u].push({ v, edgeId: eid });
      adj[v].push({ v: u, edgeId: eid });
    }
  }

  // ── 3. Tarjan's AP / Bridge — iterative DFS ───────────────────────────────
  //
  // Outer loop restarts from every unvisited node, ensuring full coverage of
  // disconnected sub-graphs and isolated files.

  const disc = new Int32Array(N).fill(-1); // -1 ≡ unvisited
  const low  = new Int32Array(N);

  const apIndices  = new Set<number>(); // vertex indices of confirmed APs
  const bridgeEids = new Set<number>(); // edge IDs of confirmed bridges
  let   timer      = 0;

  for (let root = 0; root < N; root++) {
    if (disc[root] !== -1) continue;

    disc[root] = low[root] = timer++;

    const stack: DFSFrame[] = [
      { u: root, parentEdgeId: -1, adjIdx: 0, children: 0 },
    ];

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const { u }  = frame;
      let pushedChild = false;

      // Scan u's adjacency list from where we last paused.
      // Back-edges are processed inline; we pause and descend on tree-edges.
      while (frame.adjIdx < adj[u].length) {
        const { v, edgeId: eid } = adj[u][frame.adjIdx++];

        if (eid === frame.parentEdgeId) continue; // skip the arrival edge

        if (disc[v] === -1) {
          // Tree edge — descend into child
          frame.children++;
          disc[v] = low[v] = timer++;
          stack.push({ u: v, parentEdgeId: eid, adjIdx: 0, children: 0 });
          pushedChild = true;
          break; // adjIdx already advanced; resume here after child returns
        } else {
          // Back-edge — tighten low[u]
          if (disc[v] < low[u]) low[u] = disc[v];
        }
      }

      if (pushedChild) continue;

      // u fully explored — simulate recursive return
      stack.pop();

      // Root AP: a DFS-tree root is an AP iff it spawned ≥ 2 children,
      // because only then does its removal disconnect those subtrees.
      if (frame.parentEdgeId === -1) {
        if (frame.children >= 2) apIndices.add(u);
        continue; // root has no parent; nothing to propagate
      }

      const parentFrame = stack[stack.length - 1]; // always valid here
      const pu          = parentFrame.u;

      // Propagate low upward
      if (low[u] < low[pu]) low[pu] = low[u];

      // Non-root AP: u's subtree cannot back-reach any ancestor of pu,
      // so pu is the sole connector. Guard skips the check when pu is a
      // root (its AP status is governed by children count only).
      if (parentFrame.parentEdgeId !== -1 && low[u] >= disc[pu]) {
        apIndices.add(pu);
      }

      // Bridge: u's subtree cannot even back-reach pu — the tree-edge
      // (pu → u) is the only structural connection; removing it disconnects.
      if (low[u] > disc[pu]) {
        bridgeEids.add(frame.parentEdgeId);
      }
    }
  }

  // ── 4. Map numeric indices back to file-path strings ─────────────────────
  const articulationPoints = new Set<string>(
    Array.from(apIndices, (i) => nodes[i]),
  );

  const bridges: Array<[string, string]> = Array.from(bridgeEids, (eid) => {
    const [s, t] = edgeOrigin[eid];
    return [nodes[s], nodes[t]];
  });

  // ── 5. Per-AP largest-fragment estimation ─────────────────────────────────
  //
  // For each AP, BFS the graph without that node and record the size of
  // the largest resulting fragment. Drives severity ranking in the UI.
  //
  // One Uint8Array allocated outside the loop; fill(0) between iterations
  // compiles to a single V8-optimised memset — cheaper than per-AP allocation.
  // BFS queue uses a head-pointer index: O(1) dequeue vs O(n) Array.shift().

  const componentSizes = new Map<string, number>();
  const seen           = new Uint8Array(N);

  for (const apIdx of apIndices) {
    seen.fill(0);
    seen[apIdx] = 1; // treat the AP itself as permanently visited

    let maxFragment = 0;

    for (const { v: seed } of adj[apIdx]) {
      if (seen[seed]) continue; // already part of a counted fragment

      const queue: number[] = [seed];
      seen[seed]            = 1;
      let head              = 0;
      let count             = 0;

      while (head < queue.length) {
        const cur = queue[head++];
        count++;
        for (const { v } of adj[cur]) {
          if (!seen[v]) {
            seen[v] = 1;
            queue.push(v);
          }
        }
      }

      if (count > maxFragment) maxFragment = count;
    }

    componentSizes.set(nodes[apIdx], maxFragment);
  }

  return { articulationPoints, bridges, componentSizes };
}

// ── Utility ───────────────────────────────────────────────────────────────────

/**
 * Returns every articulation point sorted by severity (highest first).
 *
 * Convenience wrapper for direct UI consumption — eliminates the sort +
 * map boilerplate from the view layer.
 *
 * @example
 * const result = computeArticulationPoints(dependencyGraph);
 * const ranked = getRankedArticulationPoints(result);
 * // ranked[0] is the most dangerous single point of failure
 */
export function getRankedArticulationPoints(
  result: ArticulationPointResult,
): RankedArticulationPoint[] {
  return Array.from(result.articulationPoints)
    .map((path): RankedArticulationPoint => ({
      path,
      disconnects: result.componentSizes.get(path) ?? 0,
    }))
    .sort((a, b) => b.disconnects - a.disconnects);
}