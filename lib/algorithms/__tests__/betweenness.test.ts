// lib/algorithms/__tests__/betweenness.test.ts

import { computeBetweenness, betweennessToSeverity } from "../betweenness";

describe("computeBetweenness", () => {
  it("returns empty scores for empty graph", () => {
    const result = computeBetweenness({});
    expect(result.scores.size).toBe(0);
    expect(result.topK(5)).toEqual([]);
  });

  it("returns empty scores for graph with fewer than 3 nodes", () => {
    const result = computeBetweenness({ a: ["b"], b: [] });
    expect(result.scores.size).toBe(0);
  });

  it("assigns high betweenness to a bridge node in a chain a→b→c→d", () => {
    const graph = { a: ["b"], b: ["c"], c: ["d"], d: [] };
    const result = computeBetweenness(graph, true);

    // b and c sit on the only path from a to d — they must have betweenness > 0
    expect(result.scores.get("b")).toBeGreaterThan(0);
    expect(result.scores.get("c")).toBeGreaterThan(0);
    // a and d are endpoints — betweenness = 0 in a simple chain
    expect(result.scores.get("a")).toBe(0);
    expect(result.scores.get("d")).toBe(0);
  });

  it("assigns highest betweenness to the hub in a star graph", () => {
    // hub imports all leaves; all paths between leaves go through hub
    const graph = {
      hub: ["l1", "l2", "l3", "l4"],
      l1: [],
      l2: [],
      l3: [],
      l4: [],
    };
    const result = computeBetweenness(graph, true);
    const top = result.topK(1);
    expect(top[0][0]).toBe("hub");
  });

  it("topK returns at most k results sorted descending", () => {
    const graph = {
      a: ["b", "c"],
      b: ["d"],
      c: ["d"],
      d: ["e"],
      e: [],
    };
    const result = computeBetweenness(graph, true);
    const top2 = result.topK(2);
    expect(top2.length).toBeLessThanOrEqual(2);
    if (top2.length === 2) {
      expect(top2[0][1]).toBeGreaterThanOrEqual(top2[1][1]);
    }
  });

  it("normalized scores are in [0, 1]", () => {
    const graph = {
      a: ["b", "c"],
      b: ["d"],
      c: ["d"],
      d: [],
    };
    const result = computeBetweenness(graph, true);
    for (const score of result.scores.values()) {
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});

describe("betweennessToSeverity", () => {
  it("maps 0 to low", () => expect(betweennessToSeverity(0)).toBe("low"));
  it("maps 0.05 to medium", () => expect(betweennessToSeverity(0.05)).toBe("medium"));
  it("maps 0.10 to high", () => expect(betweennessToSeverity(0.10)).toBe("high"));
  it("maps 0.20 to critical", () => expect(betweennessToSeverity(0.20)).toBe("critical"));
});