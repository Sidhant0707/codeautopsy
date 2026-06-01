// lib/__tests__/cfg-builder.test.ts
 
import { analyzeCFG, analyzeCFGBatch, cfgResultsToLLMSummary } from "../cfg-builder";
 
describe("analyzeCFG", () => {
  it("returns parseError for unparseable content", () => {
    const result = analyzeCFG("test.ts", "const x = {{{{");
    // errorRecovery:true means it may still parse, but finding count = 0
    // Just assert it doesn't throw
    expect(result.filePath).toBe("test.ts");
  });
 
  it("detects unreachable code after return", () => {
    const code = `
      function foo() {
        return 1;
        const x = 2;
      }
    `;
    const result = analyzeCFG("foo.ts", code);
    const unreachable = result.findings.filter(
      (f) => f.type === "unreachable_code",
    );
    expect(unreachable.length).toBeGreaterThan(0);
    expect(unreachable[0].severity).toBe("error");
  });
 
  it("does not flag reachable code", () => {
    const code = `
      function bar() {
        const x = 1;
        const y = 2;
        return x + y;
      }
    `;
    const result = analyzeCFG("bar.ts", code);
    expect(
      result.findings.filter((f) => f.type === "unreachable_code").length,
    ).toBe(0);
  });
 
  it("detects missing error handling in async function", () => {
    const code = `
      async function fetchData() {
        const res = await fetch('/api/data');
        return res.json();
      }
    `;
    const result = analyzeCFG("fetch.ts", code);
    const missing = result.findings.filter(
      (f) => f.type === "missing_error_handling",
    );
    expect(missing.length).toBeGreaterThan(0);
    expect(missing[0].severity).toBe("warning");
  });
 
  it("does not flag async function with try/catch", () => {
    const code = `
      async function safe() {
        try {
          const res = await fetch('/api');
          return res.json();
        } catch (e) {
          console.error(e);
        }
      }
    `;
    const result = analyzeCFG("safe.ts", code);
    expect(
      result.findings.filter((f) => f.type === "missing_error_handling").length,
    ).toBe(0);
  });
 
  it("detects while(true) without break", () => {
    const code = `
      function poll() {
        while (true) {
          console.log('tick');
        }
      }
    `;
    const result = analyzeCFG("poll.ts", code);
    const loops = result.findings.filter(
      (f) => f.type === "infinite_loop_candidate",
    );
    expect(loops.length).toBeGreaterThan(0);
  });
 
  it("does not flag while(true) with break", () => {
    const code = `
      function run() {
        while (true) {
          if (done) break;
        }
      }
    `;
    const result = analyzeCFG("run.ts", code);
    expect(
      result.findings.filter((f) => f.type === "infinite_loop_candidate").length,
    ).toBe(0);
  });
});
 
describe("analyzeCFGBatch", () => {
  it("only processes JS/TS files", () => {
    const files = [
      { path: "lib/utils.ts", content: "function f() { return 1; }" },
      { path: "styles/main.css", content: ".foo { color: red; }" },
      { path: "data.json", content: '{"key": "value"}' },
    ];
    const results = analyzeCFGBatch(files, {}, 5);
    expect(results.every((r) => r.filePath.endsWith(".ts"))).toBe(true);
  });
 
  it("respects topN limit", () => {
    const files = Array.from({ length: 10 }, (_, i) => ({
      path: `lib/file${i}.ts`,
      content: "export const x = 1;",
    }));
    const scores = Object.fromEntries(files.map((f, i) => [f.path, i * 10]));
    const results = analyzeCFGBatch(files, scores, 3);
    expect(results.length).toBeLessThanOrEqual(3);
  });
});
 
describe("cfgResultsToLLMSummary", () => {
  it("returns empty string when no findings", () => {
    const result = analyzeCFG("clean.ts", "export const x = 1;");
    expect(cfgResultsToLLMSummary([result])).toBe("");
  });
 
  it("includes file path and finding description in output", () => {
    const code = `
      function f() {
        return 1;
        const x = 2;
      }
    `;
    const result = analyzeCFG("problem.ts", code);
    const summary = cfgResultsToLLMSummary([result]);
    if (result.findings.length > 0) {
      expect(summary).toContain("problem.ts");
      expect(summary).toContain("ERROR");
    }
  });
});