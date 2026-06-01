// lib/__tests__/file-filter.test.ts
 
import { shouldSkipFile, filterFiles } from "../file-filter";
 
describe("shouldSkipFile", () => {
  // Directory-based skips
  it("skips node_modules", () =>
    expect(shouldSkipFile("node_modules/lodash/index.js")).toBe(true));
  it("skips .next", () =>
    expect(shouldSkipFile(".next/server/app/page.js")).toBe(true));
  it("skips dist", () =>
    expect(shouldSkipFile("dist/index.js")).toBe(true));
 
  // Extension-based skips
  it("skips .min.js", () =>
    expect(shouldSkipFile("public/vendor.min.js")).toBe(true));
  it("skips .bundle.js", () =>
    expect(shouldSkipFile("public/app.bundle.js")).toBe(true));
  it("skips .d.ts", () =>
    expect(shouldSkipFile("types/global.d.ts")).toBe(true));
  it("skips .generated.ts", () =>
    expect(shouldSkipFile("lib/schema.generated.ts")).toBe(true));
  it("skips .map files", () =>
    expect(shouldSkipFile("public/main.js.map")).toBe(true));
 
  // Filename pattern skips
  it("skips .mock.ts", () =>
    expect(shouldSkipFile("lib/api.mock.ts")).toBe(true));
  it("skips .fixture.tsx", () =>
    expect(shouldSkipFile("components/Button.fixture.tsx")).toBe(true));
  it("skips __mocks__ directory", () =>
    expect(shouldSkipFile("lib/__mocks__/supabase.ts")).toBe(true));
  it("skips .stories.tsx", () =>
    expect(shouldSkipFile("components/Button.stories.tsx")).toBe(true));
 
  // Size-based skip
  it("skips files over maxSizeBytes", () =>
    expect(shouldSkipFile("lib/big.ts", 100_000)).toBe(true));
  it("allows files under maxSizeBytes", () =>
    expect(shouldSkipFile("lib/small.ts", 1_000)).toBe(false));
 
  // Allowed files
  it("allows normal source files", () =>
    expect(shouldSkipFile("lib/utils.ts")).toBe(false));
  it("allows React components", () =>
    expect(shouldSkipFile("components/Button.tsx")).toBe(false));
  it("allows API routes", () =>
    expect(shouldSkipFile("app/api/analyze/route.ts")).toBe(false));
  it("allows test files themselves", () =>
    expect(shouldSkipFile("lib/utils.test.ts")).toBe(false));
});
 
describe("filterFiles", () => {
  it("removes skipped files and keeps valid ones", () => {
    const files = [
      { path: "lib/utils.ts", size: 1000 },
      { path: "dist/bundle.js", size: 5000 },
      { path: "lib/api.mock.ts", size: 500 },
      { path: "components/Nav.tsx", size: 2000 },
    ];
    const result = filterFiles(files);
    expect(result.map((f) => f.path)).toEqual([
      "lib/utils.ts",
      "components/Nav.tsx",
    ]);
  });
});