// lib/file-filter.ts
//
// Upgraded file filter with repo-type detection and strict graph-node gating.
// Three layers of filtering:
//   1. shouldSkipFile     — hard rejects (unchanged contract, stricter set)
//   2. isGraphNode        — can this file have JS/TS import statements?
//   3. detectRepoType     — what kind of repo is this? used for early-exit UX
//   4. assessGraphQuality — is the resulting graph worth visualizing?

export interface FileFilterOptions {
  maxSizeBytes?: number;
}

// ─── Layer 1: Hard skips (never fetch, never process) ────────────────────────

const SKIP_DIRECTORIES = new Set([
  "node_modules", "dist", "build", ".next", ".git", "coverage",
  "__pycache__", ".yarn", "vendor", ".turbo", ".cache", "out",
  "storybook-static", ".output", ".vercel", ".netlify", "tmp", "temp",
  "logs", "log", ".idea", ".vscode", ".vs",
]);

const SKIP_EXTENSIONS = new Set([
  // Compiled / minified
  ".min.js", ".min.css", ".bundle.js", ".chunk.js",
  ".map", ".lock",
  // Type stubs (no runtime imports)
  ".d.ts",
  // Generated
  ".generated.ts", ".generated.tsx",
  // Media
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
  ".woff", ".woff2", ".ttf", ".eot", ".otf",
  ".mp4", ".mp3", ".wav", ".webp", ".avif",
  // Archives
  ".pdf", ".zip", ".tar", ".gz", ".bz2", ".7z",
  // Data (large, not importable)
  ".csv", ".parquet", ".arrow", ".npy", ".pkl",
  // Binary / compiled outputs
  ".exe", ".dll", ".so", ".dylib", ".class", ".pyc", ".pyo",
  ".o", ".a", ".lib", ".wasm",
  // Notebooks (not importable as modules)
  ".ipynb",
]);

const SKIP_FILENAME_PATTERNS = [
  /\.mock\.[jt]sx?$/i,
  /\.fixture\.[jt]sx?$/i,
  /\.stories\.[jt]sx?$/i,
  /\.storybook/i,
  /\.generated\./i,
  /repomix-output/i,
  /package-lock\.json$/i,
  /yarn\.lock$/i,
  /pnpm-lock\.yaml$/i,
  /composer\.lock$/i,
  /Gemfile\.lock$/i,
  /poetry\.lock$/i,
  // Auto-generated proto/grpc files
  /\.pb\.go$/i,
  /\.pb\.ts$/i,
  /_pb2\.py$/i,
  // Compiled CSS-in-JS artifacts
  /styled-components\.d\.ts$/i,
];

const SKIP_DIR_PATTERNS = [
  /__mocks__/,
  /__fixtures__/,
  /\/__tests__\//,
  /\/\.storybook\//,
  /\/storybook\//,
  /\/migrations\//,         // DB migration files — not importable
  /\/seeds?\//,             // DB seed files
  /\/snapshots?\//,         // Jest snapshots
  /\/\.github\//,           // CI configs
  /\/\.husky\//,
  /\/scripts\/generated\//,
];

const DEFAULT_MAX_SIZE_BYTES = 50_000;

export function shouldSkipFile(
  path: string,
  sizeBytes?: number,
  options: FileFilterOptions = {},
): boolean {
  const maxSize = options.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
  const segments = path.split("/");

  // Directory segment check
  for (const seg of segments.slice(0, -1)) {
    if (SKIP_DIRECTORIES.has(seg)) return true;
  }

  // Dir pattern check
  for (const pattern of SKIP_DIR_PATTERNS) {
    if (pattern.test(path)) return true;
  }

  // Extension check — compound extensions like .min.js, .d.ts
  const filename = segments[segments.length - 1];
  for (const ext of SKIP_EXTENSIONS) {
    if (filename.endsWith(ext)) return true;
  }

  // Filename pattern check
  for (const pattern of SKIP_FILENAME_PATTERNS) {
    if (pattern.test(path)) return true;
  }

  // Size check
  if (sizeBytes !== undefined && sizeBytes > maxSize) return true;

  return false;
}

// ─── Layer 2: Graph node gate ─────────────────────────────────────────────────
// Only files that can contain JS/TS import/require statements should enter
// the dependency graph. Everything else gets fetched for LLM context only
// (if relevant) but never becomes a node.

const JS_TS_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".mts", ".cts",
]);

// These can reference JS/TS files via <script src> or require() — keep them
// as graph nodes but with a lower weight.
const WEAK_GRAPH_EXTENSIONS = new Set([
  ".html", ".htm", ".vue", ".svelte", ".astro",
]);

// Config files that are read for metadata but should NEVER be graph nodes
// (they don't import application code).
const CONFIG_ONLY_EXTENSIONS = new Set([
  ".json", ".yaml", ".yml", ".toml", ".ini", ".env",
  ".xml", ".gradle", ".properties",
]);

// Non-JS languages — these files have zero JS import syntax.
const NON_JS_EXTENSIONS = new Set([
  ".py", ".rb", ".go", ".java", ".kt", ".kts", ".scala",
  ".cs", ".cpp", ".cc", ".cxx", ".c", ".h", ".hpp",
  ".rs", ".swift", ".m", ".mm", ".php", ".lua", ".r",
  ".sh", ".bash", ".zsh", ".fish", ".ps1", ".bat", ".cmd",
  ".sql", ".graphql", ".gql", ".proto", ".thrift",
  ".md", ".mdx", ".txt", ".rst", ".adoc",
  ".css", ".scss", ".sass", ".less", ".styl",
]);

export type GraphNodeStrength = "strong" | "weak" | "none";

/**
 * Returns whether a file should be a node in the dependency graph.
 * "strong" = JS/TS file with real import syntax
 * "weak"   = HTML/Vue/Svelte — may reference JS files
 * "none"   = cannot have JS imports; exclude from graph entirely
 */
export function getGraphNodeStrength(path: string): GraphNodeStrength {
  const filename = path.split("/").pop() ?? "";
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return "none"; // no extension = binary or unknown

  const ext = filename.slice(lastDot).toLowerCase();

  if (JS_TS_EXTENSIONS.has(ext)) return "strong";
  if (WEAK_GRAPH_EXTENSIONS.has(ext)) return "weak";
  if (NON_JS_EXTENSIONS.has(ext)) return "none";
  if (CONFIG_ONLY_EXTENSIONS.has(ext)) return "none";

  // Unknown extension — be conservative, exclude from graph
  return "none";
}

/**
 * Should this file be fetched at all (for LLM context or graph building)?
 * Stricter than shouldSkipFile for non-JS repos.
 */
export function isGraphNode(path: string): boolean {
  return getGraphNodeStrength(path) !== "none";
}

// ─── Layer 3: Repo type detection ────────────────────────────────────────────

export type RepoLanguage =
  | "typescript"   // .ts/.tsx dominant
  | "javascript"   // .js/.jsx dominant
  | "python"       // .py dominant
  | "go"           // .go dominant
  | "java"         // .java/.kt dominant
  | "rust"         // .rs dominant
  | "cpp"          // .cpp/.c dominant
  | "mixed"        // no clear dominant language
  | "docs"         // mostly .md/.txt — documentation repo
  | "data"         // mostly notebooks/CSVs
  | "unknown";

export interface RepoTypeResult {
  language: RepoLanguage;
  /** 0–1: fraction of files that are JS/TS graph nodes */
  jsRatio: number;
  /** true if this repo can produce a meaningful dependency graph */
  isGraphable: boolean;
  /** Human-readable reason if not graphable */
  reason?: string;
  /** Total files inspected */
  totalFiles: number;
  /** Count of strong JS/TS graph nodes */
  jsNodeCount: number;
}

const LANG_EXTENSIONS: Record<string, RepoLanguage> = {
  ".ts": "typescript", ".tsx": "typescript", ".mts": "typescript", ".cts": "typescript",
  ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript", ".cjs": "javascript",
  ".py": "python",
  ".go": "go",
  ".java": "java", ".kt": "java", ".kts": "java",
  ".rs": "rust",
  ".cpp": "cpp", ".cc": "cpp", ".cxx": "cpp", ".c": "cpp", ".h": "cpp", ".hpp": "cpp",
  ".md": "docs", ".mdx": "docs", ".txt": "docs", ".rst": "docs",
  ".ipynb": "data", ".csv": "data", ".parquet": "data",
};

/**
 * Inspect a list of file paths and determine what kind of repo this is.
 * Call this BEFORE running the pipeline to decide whether to proceed.
 */
export function detectRepoType(paths: string[]): RepoTypeResult {
  const langCounts: Partial<Record<RepoLanguage, number>> = {};
  let jsNodeCount = 0;
  let total = 0;

  for (const path of paths) {
    // Skip directories/build artifacts we'd normally skip
    const segments = path.split("/");
    const isSkipped = segments
      .slice(0, -1)
      .some((s) => SKIP_DIRECTORIES.has(s));
    if (isSkipped) continue;

    const filename = segments[segments.length - 1];
    const lastDot = filename.lastIndexOf(".");
    if (lastDot === -1) continue;

    const ext = filename.slice(lastDot).toLowerCase();
    total++;

    const lang = LANG_EXTENSIONS[ext];
    if (lang) {
      langCounts[lang] = (langCounts[lang] ?? 0) + 1;
    }

    if (JS_TS_EXTENSIONS.has(ext)) jsNodeCount++;
  }

  if (total === 0) {
    return {
      language: "unknown",
      jsRatio: 0,
      isGraphable: false,
      reason: "No files found in repository.",
      totalFiles: 0,
      jsNodeCount: 0,
    };
  }

  // Find dominant language
  let dominant: RepoLanguage = "unknown";
  let maxCount = 0;
  for (const [lang, count] of Object.entries(langCounts) as [RepoLanguage, number][]) {
    if ((count ?? 0) > maxCount) {
      maxCount = count ?? 0;
      dominant = lang;
    }
  }

  // Combine typescript + javascript counts for the JS family ratio
  const jsFamilyCount =
    (langCounts["typescript"] ?? 0) + (langCounts["javascript"] ?? 0);
  const jsRatio = jsFamilyCount / total;

  // Determine if graphable
  // Need at least 3 JS/TS files AND at least 5% of the repo to be JS/TS
  const MIN_JS_FILES = 3;
  const MIN_JS_RATIO = 0.05;

  const isGraphable = jsNodeCount >= MIN_JS_FILES && jsRatio >= MIN_JS_RATIO;
  let reason: string | undefined;

  if (!isGraphable) {
    if (jsNodeCount === 0) {
      reason = `This appears to be a ${dominant} repository with no JavaScript/TypeScript files. Dependency graph requires JS/TS imports.`;
    } else if (jsNodeCount < MIN_JS_FILES) {
      reason = `Only ${jsNodeCount} JS/TS file(s) found — not enough to build a meaningful dependency graph.`;
    } else {
      reason = `JS/TS files make up only ${Math.round(jsRatio * 100)}% of this repo. The dependency graph would be mostly disconnected.`;
    }
  }

  // If mixed but still has enough JS — allow it but flag it
  if (dominant !== "typescript" && dominant !== "javascript" && isGraphable) {
    reason = `Mixed repo (dominant: ${dominant}). Only JS/TS files will appear in the dependency graph — ${jsNodeCount} of ${total} files.`;
  }

  return {
    language: dominant,
    jsRatio,
    isGraphable,
    reason,
    totalFiles: total,
    jsNodeCount,
  };
}

// ─── Layer 4: Post-graph quality assessment ───────────────────────────────────

export interface GraphQualityResult {
  /** 0–1: fraction of nodes with at least one edge */
  connectedness: number;
  /** true if the graph is worth visualizing */
  isUseful: boolean;
  /** Human-readable diagnosis */
  diagnosis: string;
  orphanCount: number;
  totalNodes: number;
  edgeCount: number;
}

/**
 * After buildDependencyGraph runs, assess whether the result is useful.
 * Call this before rendering ArchitectureMap — if !isUseful, show an
 * empty state with the diagnosis instead of a scattered orphan cloud.
 */
export function assessGraphQuality(
  graph: Record<string, string[]>,
): GraphQualityResult {
  const totalNodes = Object.keys(graph).length;
  if (totalNodes === 0) {
    return {
      connectedness: 0,
      isUseful: false,
      diagnosis: "No nodes in graph.",
      orphanCount: 0,
      totalNodes: 0,
      edgeCount: 0,
    };
  }

  const nodesWithOutbound = new Set<string>();
  const nodesWithInbound = new Set<string>();
  let edgeCount = 0;

  for (const [src, targets] of Object.entries(graph)) {
    if (targets.length > 0) nodesWithOutbound.add(src);
    for (const t of targets) {
      nodesWithInbound.add(t);
      edgeCount++;
    }
  }

  const orphanCount = Object.keys(graph).filter(
    (n) => !nodesWithOutbound.has(n) && !nodesWithInbound.has(n),
  ).length;

  const connectedNodes = Object.keys(graph).filter(
    (n) => nodesWithOutbound.has(n) || nodesWithInbound.has(n),
  ).length;

  const connectedness = connectedNodes / totalNodes;

  // Thresholds:
  // < 2 edges       → definitely useless
  // < 20% connected → mostly orphans, not useful
  const isUseful = edgeCount >= 2 && connectedness >= 0.2;

  let diagnosis: string;
  if (edgeCount === 0) {
    diagnosis = "No import relationships found between files. This repo may not use ES module imports.";
  } else if (connectedness < 0.2) {
    diagnosis = `${orphanCount} of ${totalNodes} files are isolated (no imports/importers). The graph is too sparse to be useful.`;
  } else if (connectedness < 0.4) {
    diagnosis = `Graph is partially connected — ${connectedNodes} of ${totalNodes} files have dependencies. Some areas may appear sparse.`;
  } else {
    diagnosis = `Graph looks healthy — ${connectedNodes} connected nodes, ${edgeCount} edges.`;
  }

  return {
    connectedness,
    isUseful,
    diagnosis,
    orphanCount,
    totalNodes,
    edgeCount,
  };
}

// ─── Existing API (unchanged contract) ───────────────────────────────────────

export function filterFiles(
  files: Array<{ path: string; size?: number }>,
  options: FileFilterOptions = {},
): Array<{ path: string; size?: number }> {
  return files.filter((f) => !shouldSkipFile(f.path, f.size, options));
}

/**
 * Filter files down to only those that should enter the dependency graph.
 * Use this instead of filterFiles when building the graph.
 */
export function filterGraphFiles(
  files: Array<{ path: string; size?: number }>,
  options: FileFilterOptions = {},
): Array<{ path: string; size?: number }> {
  return files.filter(
    (f) => !shouldSkipFile(f.path, f.size, options) && isGraphNode(f.path),
  );
}