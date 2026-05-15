export interface RepoFile {
  path: string;
  score: number;
  role: "entry" | "config" | "core" | "test" | "other";
}

const ENTRY_PATTERNS = [
  "index.js", "index.ts", "index.jsx", "index.tsx",
  "main.js", "main.ts", "main.jsx", "main.tsx",
  "app.js", "app.ts", "app.jsx", "app.tsx",
  "server.js", "server.ts",
  "page.js", "page.ts", "page.jsx", "page.tsx",
  "layout.js", "layout.ts", "layout.jsx", "layout.tsx",
  "main.py", "app.py", "manage.py", "wsgi.py",
  "main.go", "cmd/main.go",
];

const CONFIG_PATTERNS = [
  "package.json", "tsconfig.json", "pyproject.toml",
  "requirements.txt", "Dockerfile", "docker-compose.yml",
  ".env.example", "next.config", "vite.config", "webpack.config",
];

const TEST_PATTERNS = ["test", "spec", "__tests__", "fixtures"];

export function classifyAndScoreFiles(paths: string[]): RepoFile[] {
  return paths.map((path) => {
    const filename = path.split("/").pop() || "";
    let score = 0;
    let role: RepoFile["role"] = "other";

    
    if (ENTRY_PATTERNS.some((p) => filename === p || path.endsWith("/" + p))) {
      score += 10;
      role = "entry";
    }

    
    if (CONFIG_PATTERNS.some((p) => filename.startsWith(p) || path.endsWith(p))) {
      score += 6;
      role = "config";
    }

    
    if (TEST_PATTERNS.some((p) => path.includes(p))) {
      score -= 4;
      role = "test";
    }

    
    const depth = path.split("/").length;
    if (depth === 1) score += 3;
    if (path.startsWith("src/") || path.startsWith("lib/")) score += 2;

    
    if (depth > 4) score -= 2;

    
    if (path.startsWith("examples/") || path.startsWith("demo/") || path.startsWith("sample/")) {
      score -= 5;
      if (role === "entry") role = "other";
    }

    return { path, score, role };
  });
}

export function getTopFiles(files: RepoFile[], limit = 30): RepoFile[] {
  // 1. We MUST allow config files through so the Alias Resolver can read tsconfig.json!
  const cleanFiles = files.filter(
    (f) => f.role !== "test" && !f.path.endsWith('.md')
  );

  // 2. Separate into categories
  const entries = cleanFiles.filter(f => f.role === "entry").sort((a, b) => b.score - a.score);
  const coreFiles = cleanFiles.filter(f => f.role !== "entry").sort((a, b) => b.score - a.score);

  // 3. Force Diversity: Cap entry points to 8
  const maxEntries = 8;
  const selectedEntries = entries.slice(0, maxEntries);
  
  // 4. Fill remaining slots
  const remainingSlots = limit - selectedEntries.length;
  const selectedCore = coreFiles.slice(0, remainingSlots);

  return [...selectedEntries, ...selectedCore];
}