// lib/__tests__/dependency-graph-depth.test.ts
//
// Tests for the getFilesByDepth function added to lib/dependency-graph.ts.
// Import path assumes you've spliced getFilesByDepth into that file.

import { getFilesByDepth } from "../dependency-graph";

describe("getFilesByDepth", () => {
  const graph = {
    "app/page.tsx": ["components/Nav.tsx", "lib/utils.ts"],
    "components/Nav.tsx": ["lib/constants.ts"],
    "lib/utils.ts": ["lib/helpers.ts"],
    "lib/helpers.ts": [],
    "lib/constants.ts": [],
    "orphan.ts": [],
  };

  it("returns entry points at depth 0", () => {
    const result = getFilesByDepth(graph, ["app/page.tsx"], 3, 60);
    expect(result.depthMap["app/page.tsx"]).toBe(0);
  });

  it("returns direct deps at depth 1", () => {
    const result = getFilesByDepth(graph, ["app/page.tsx"], 3, 60);
    expect(result.depthMap["components/Nav.tsx"]).toBe(1);
    expect(result.depthMap["lib/utils.ts"]).toBe(1);
  });

  it("returns transitive deps at depth 2", () => {
    const result = getFilesByDepth(graph, ["app/page.tsx"], 3, 60);
    expect(result.depthMap["lib/constants.ts"]).toBe(2);
    expect(result.depthMap["lib/helpers.ts"]).toBe(2);
  });

  it("respects maxDepth — does not go deeper than specified", () => {
    const result = getFilesByDepth(graph, ["app/page.tsx"], 1, 60);
    // depth 2 nodes should not appear
    expect(result.depthMap["lib/constants.ts"]).toBeUndefined();
    expect(result.depthMap["lib/helpers.ts"]).toBeUndefined();
  });

  it("respects maxNodes hard cap", () => {
    const result = getFilesByDepth(graph, ["app/page.tsx"], 3, 2);
    expect(result.files.length).toBeLessThanOrEqual(2);
  });

  it("includes orphan nodes via fallbackRanked when BFS doesn't fill quota", () => {
    const result = getFilesByDepth(
      graph,
      ["app/page.tsx"],
      3,
      60,
      ["orphan.ts"],
    );
    expect(result.files).toContain("orphan.ts");
    expect(result.depthMap["orphan.ts"]).toBe(4); // maxDepth + 1 = fallback tier
  });

  it("seeds from high-fanIn nodes when entryPoints is empty", () => {
    const result = getFilesByDepth(graph, [], 3, 60);
    // Should not throw and should return some files
    expect(result.files.length).toBeGreaterThan(0);
  });

  it("does not include duplicate nodes", () => {
    const result = getFilesByDepth(graph, ["app/page.tsx"], 3, 60);
    const uniqueFiles = new Set(result.files);
    expect(result.files.length).toBe(uniqueFiles.size);
  });
});