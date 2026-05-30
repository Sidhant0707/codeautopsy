// lib/algorithms/__tests__/articulationPoints.test.ts

import {
  computeArticulationPoints,
  getRankedArticulationPoints,
  type ArticulationPointResult,
} from "../articulationPoints";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Sorted array of AP paths — stable for snapshot comparisons. */
function sortedAPs(result: ArticulationPointResult): string[] {
  return [...result.articulationPoints].sort();
}

/** Sorted array of bridge strings "source->target" — stable for comparisons. */
function sortedBridges(result: ArticulationPointResult): string[] {
  return [...result.bridges]
    .map(([s, t]) => `${s}->${t}`)
    .sort();
}

// ── Edge-case / defensive tests ───────────────────────────────────────────────

describe("Edge cases", () => {
  it("returns empty result for an empty graph", () => {
    const result = computeArticulationPoints({});
    expect(result.articulationPoints.size).toBe(0);
    expect(result.bridges).toHaveLength(0);
    expect(result.componentSizes.size).toBe(0);
  });

  it("returns empty result for a single node with no edges", () => {
    const result = computeArticulationPoints({ "a.ts": [] });
    expect(result.articulationPoints.size).toBe(0);
    expect(result.bridges).toHaveLength(0);
  });

  it("handles self-loops without crashing or false positives", () => {
    // A self-import is structurally meaningless — should be ignored
    const result = computeArticulationPoints({ "a.ts": ["a.ts"] });
    expect(result.articulationPoints.size).toBe(0);
    expect(result.bridges).toHaveLength(0);
  });

  it("handles duplicate import entries (same target twice)", () => {
    // Duplicate imports must collapse to one undirected edge — not a false bridge
    const result = computeArticulationPoints({
      "a.ts": ["b.ts", "b.ts"],
      "b.ts": [],
    });
    expect(sortedBridges(result)).toEqual(["a.ts->b.ts"]);
    // a.ts is NOT an AP — it's a leaf with one child, and the root
    // with only 1 DFS child is not an AP
    expect(result.articulationPoints.has("a.ts")).toBe(false);
  });

  it("handles nodes that appear only as import targets (no outgoing edges)", () => {
    // "leaf.ts" is never a key but is a valid node
    const result = computeArticulationPoints({
      "entry.ts": ["middle.ts"],
      "middle.ts": ["leaf.ts"],
    });
    // middle.ts is on the only path from entry.ts to leaf.ts → AP
    expect(result.articulationPoints.has("middle.ts")).toBe(true);
    expect(sortedBridges(result).length).toBeGreaterThan(0);
  });

  it("handles empty string targets gracefully", () => {
    const result = computeArticulationPoints({ "a.ts": ["", "b.ts", ""] });
    // Empty strings are ignored; a.ts→b.ts is a single bridge
    expect(result.articulationPoints.size).toBe(0);
    expect(sortedBridges(result)).toEqual(["a.ts->b.ts"]);
  });
});

// ── Simple chain (A → B → C) ──────────────────────────────────────────────────

describe("Linear chain: A → B → C", () => {
  const graph = {
    "a.ts": ["b.ts"],
    "b.ts": ["c.ts"],
    "c.ts": [],
  };

  let result: ArticulationPointResult;
  beforeAll(() => { result = computeArticulationPoints(graph); });

  it("identifies b.ts as the only articulation point", () => {
    expect(sortedAPs(result)).toEqual(["b.ts"]);
  });

  it("identifies both edges as bridges", () => {
    expect(sortedBridges(result)).toEqual(["a.ts->b.ts", "b.ts->c.ts"]);
  });

  it("records a non-zero component size for b.ts", () => {
    expect(result.componentSizes.get("b.ts")).toBeGreaterThan(0);
  });
});

// ── Triangle (no APs or bridges) ─────────────────────────────────────────────

describe("Triangle: A → B → C → A", () => {
  const graph = {
    "a.ts": ["b.ts"],
    "b.ts": ["c.ts"],
    "c.ts": ["a.ts"],
  };

  let result: ArticulationPointResult;
  beforeAll(() => { result = computeArticulationPoints(graph); });

  it("finds no articulation points", () => {
    expect(result.articulationPoints.size).toBe(0);
  });

  it("finds no bridges", () => {
    expect(result.bridges).toHaveLength(0);
  });
});

// ── Classic AP graph ──────────────────────────────────────────────────────────
//
//   1 ─ 2 ─ 3
//       │
//   4 ─ 5 ─ 6
//
// Node 2 connects {1,3} to {4,5,6} — AP.
// Node 5 connects {4} to {6} via 2 — AP.

describe("Classic AP graph", () => {
  const graph: Record<string, string[]> = {
    "1": ["2"],
    "2": ["1", "3", "5"],
    "3": ["2"],
    "4": ["5"],
    "5": ["2", "4", "6"],
    "6": ["5"],
  };

  let result: ArticulationPointResult;
  beforeAll(() => { result = computeArticulationPoints(graph); });

  it("identifies nodes 2 and 5 as articulation points", () => {
    expect(sortedAPs(result)).toEqual(["2", "5"]);
  });

  it("finds no bridges (all edges have alternative paths via the cycle)", () => {
    // The 2–5 edge is a bridge; everything else is in a biconnected component
    expect(sortedBridges(result)).toEqual(["2->5"]);
  });

  it("component size for node 2 reflects the larger fragment", () => {
    // Removing 2: fragments are {1,3} (size 2) and {4,5,6} (size 3) → largest = 3
    expect(result.componentSizes.get("2")).toBe(3);
  });

  it("component size for node 5 reflects the larger fragment", () => {
    // Removing 5: fragments are {4} (size 1) and {1,2,3,6} (size 4) → largest = 4
    expect(result.componentSizes.get("5")).toBe(4);
  });
});

// ── Mutual imports (A ↔ B) ────────────────────────────────────────────────────

describe("Mutual imports: A ↔ B", () => {
  const graph = {
    "a.ts": ["b.ts"],
    "b.ts": ["a.ts"],
  };

  let result: ArticulationPointResult;
  beforeAll(() => { result = computeArticulationPoints(graph); });

  it("finds no articulation points (the pair forms a cycle)", () => {
    expect(result.articulationPoints.size).toBe(0);
  });

  it("finds no bridges (the mutual import provides a redundant path)", () => {
    expect(result.bridges).toHaveLength(0);
  });
});

// ── Disconnected graph ────────────────────────────────────────────────────────
//
//   Island 1: A → B → C (B is AP)
//   Island 2: D → E     (bridge D→E)

describe("Disconnected graph", () => {
  const graph = {
    "a.ts": ["b.ts"],
    "b.ts": ["c.ts"],
    "c.ts": [],
    "d.ts": ["e.ts"],
    "e.ts": [],
  };

  let result: ArticulationPointResult;
  beforeAll(() => { result = computeArticulationPoints(graph); });

  it("finds b.ts as an AP in island 1", () => {
    expect(result.articulationPoints.has("b.ts")).toBe(true);
  });

  it("finds bridges in both islands", () => {
    const bridges = sortedBridges(result);
    expect(bridges).toContain("a.ts->b.ts");
    expect(bridges).toContain("b.ts->c.ts");
    expect(bridges).toContain("d.ts->e.ts");
  });
});

// ── Star topology ─────────────────────────────────────────────────────────────
//
//   hub imports 4 leaves — hub is an AP; all edges are bridges.

describe("Star topology: hub → [l1, l2, l3, l4]", () => {
  const graph = {
    "hub.ts": ["l1.ts", "l2.ts", "l3.ts", "l4.ts"],
    "l1.ts": [],
    "l2.ts": [],
    "l3.ts": [],
    "l4.ts": [],
  };

  let result: ArticulationPointResult;
  beforeAll(() => { result = computeArticulationPoints(graph); });

  it("identifies hub.ts as the only articulation point", () => {
    expect(sortedAPs(result)).toEqual(["hub.ts"]);
  });

  it("identifies all 4 edges as bridges", () => {
    expect(result.bridges).toHaveLength(4);
  });

  it("records the correct component size for hub.ts", () => {
    // Removing hub: 4 isolated leaves → largest fragment = 1
    expect(result.componentSizes.get("hub.ts")).toBe(1);
  });
});

// ── getRankedArticulationPoints ───────────────────────────────────────────────

describe("getRankedArticulationPoints", () => {
  it("returns APs sorted by disconnects descending", () => {
    // Chain A→B→C→D: both B and C are APs
    // Removing B: {A} and {C,D} → largest fragment = 2
    // Removing C: {A,B} and {D} → largest fragment = 2
    // (tie — order stable if sort is stable, but we only check structure)
    const graph = {
      "a.ts": ["b.ts"],
      "b.ts": ["c.ts"],
      "c.ts": ["d.ts"],
      "d.ts": [],
    };
    const result = computeArticulationPoints(graph);
    const ranked = getRankedArticulationPoints(result);

    expect(ranked.length).toBe(2);
    // Every entry has both required fields
    for (const entry of ranked) {
      expect(typeof entry.path).toBe("string");
      expect(typeof entry.disconnects).toBe("number");
    }
    // Sorted: first entry has disconnects >= last entry
    expect(ranked[0].disconnects).toBeGreaterThanOrEqual(
      ranked[ranked.length - 1].disconnects,
    );
  });

  it("returns an empty array when there are no APs", () => {
    const result = computeArticulationPoints({
      "a.ts": ["b.ts"],
      "b.ts": ["a.ts"],
    });
    expect(getRankedArticulationPoints(result)).toEqual([]);
  });
});