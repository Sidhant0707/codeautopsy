/**
 * lib/pipeline/ast-pipeline.ts
 *
 * Pure, framework-agnostic AST extraction pipeline.
 * Zero Next.js / Vercel / Supabase imports — safe to run from a CLI,
 * a cron job, or any future headless API route.
 */

// ── Static imports only — dynamic imports removed ────────────────────────────
import {
  parseRepoUrl,
  fetchRepoMeta,
  fetchRepoTree,
  fetchFileContent,
} from "@/lib/github";
import { classifyAndScoreFiles, getTopFiles } from "@/lib/repo-parser";
import {
  buildDependencyGraph,
  computeFanIn,
  graphToMermaid,
  getBlastRadiusTargets, // was a dynamic import in the original — static is fine
} from "@/lib/dependency-graph";
import { calculateHealthGrade } from "@/lib/analyzer/health";

// ── Constants ─────────────────────────────────────────────────────────────────
const IGNORE_PATTERNS = [
  "node_modules", "dist", "build", ".next", ".git", "coverage",
  "__pycache__", ".yarn", "vendor", "package-lock.json", "yarn.lock",
  "pnpm-lock.yaml", "repomix-output.xml",
] as const;

const IGNORE_EXTENSIONS = [
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
  ".lock", ".min.js", ".map", ".woff", ".woff2",
] as const;

const CONFIG_FILE_PATTERN  = /\.(json|md|ya?ml|config\.(js|mjs|ts|cjs))$/i;
const TEST_FILE_PATTERN    = /\.(test|spec)\.[jt]sx?$/i;
const TEST_DIR_PATTERN     = /__(tests|mocks)__\//i;

const MAX_LOCAL_FILES       = 300;
const MAX_LOCAL_SIZE_BYTES  = 2_000_000;  // 2 MB
/**
 * GitHub's secondary rate limit kicks in above ~10 concurrent authenticated
 * requests. 6 gives comfortable headroom while still being fast.
 */
const MAX_FETCH_CONCURRENCY = 6;
const FETCH_TIMEOUT_MS      = 8_000;
const MAX_FILE_LINES        = 500;
const MAX_FILES_TO_FETCH    = 30;
const MAX_FILES_IN_RESULT   = 15;
const LARGE_FILE_BYTES      = 15_000;
const BLAST_RADIUS_TOP_N    = 3;
const COVERAGE_GAP_TOP_N    = 10;
const TOP_FILES_FOR_GROQ    = 20;

// ── Typed Errors ──────────────────────────────────────────────────────────────
export type PipelineErrorCode =
  | "INVALID_REPO_URL"
  | "TOO_MANY_FILES"
  | "PAYLOAD_TOO_LARGE"
  | "NO_FILES_FOUND"
  | "FETCH_TIMEOUT";

export class PipelineError extends Error {
  public readonly code: PipelineErrorCode;
  constructor(code: PipelineErrorCode, message: string) {
    super(message);
    this.name  = "PipelineError";
    this.code  = code;
    // Maintains proper prototype chain for `instanceof` checks
    Object.setPrototypeOf(this, PipelineError.prototype);
  }
}

// ── Public Types ──────────────────────────────────────────────────────────────
export interface FileContent {
  path: string;
  content: string;
}

export interface FileMetric {
  path: string;
  size: number;
}

export interface CoverageGap {
  file: string;
  fanIn: number;
  isTested: boolean;
  testFiles: string[];
  riskScore: number;
}

export type TestCoverageMap = Record<
  string,
  { isTested: boolean; testFiles: string[] }
>;

export interface PipelineResult {
  owner: string;
  repo: string;
  branch: string;
  description: string;
  stars: number;
  language: string;
  totalFiles: number;
  entryPoints: string[];
  dependencyGraph: Record<string, string[]>;
  fanIn: Record<string, number>;
  mermaidDiagram: string;
  fileContents: FileContent[];
  fileMetrics: FileMetric[];
  healthMetrics: ReturnType<typeof calculateHealthGrade>;
  testCoverageMap: TestCoverageMap;
  coverageGaps: CoverageGap[];
  topFilesForGroq: Array<{ path: string; role: string }>;
  blastRadiusTargets: string[];
  analysis: null;
  /** Present only when the result was served from the DB cache. */
  cached?: true;
}

export interface PipelineParams {
  repoUrl: string;
  githubToken: string;
  isLocal?: boolean;
  localFiles?: unknown[];
  /**
   * Injected by the caller so the pure pipeline can check the DB without
   * importing Supabase. Returning null/undefined means "cache miss".
   * Any error thrown by this callback is caught and treated as a cache miss —
   * the pipeline continues with a fresh analysis.
   */
  checkCache?: (commitSha: string) => Promise<PipelineResult | null | undefined>;
}

// ── Concurrency Semaphore ─────────────────────────────────────────────────────
class Semaphore {
  private permits: number;
  private readonly queue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  acquire(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve();
      } else {
        this.queue.push(resolve);
      }
    });
  }

  release(): void {
    // If a waiter is queued, pass the permit directly — don't increment and
    // then decrement, which would allow a race window where permits > max.
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.permits++;
    }
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/**
 * Races `promise` against a hard deadline.
 *
 * The critical correctness detail: the timeout's `clearTimeout` fires in
 * `.finally()` whether the promise wins or the timeout wins. Without this,
 * the Node timer keeps the event loop alive (and Vercel's function budget
 * ticking) even after the race has already settled.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timerId: ReturnType<typeof setTimeout> | undefined;

  const deadline = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => {
      reject(new PipelineError("FETCH_TIMEOUT", `Timed out after ${ms}ms`));
    }, ms);
  });

  return Promise.race([promise, deadline]).finally(() => {
    clearTimeout(timerId);
  }) as Promise<T>;
}

function isIgnoredFile(path: string): boolean {
  return (
    IGNORE_PATTERNS.some((p) => path.includes(p)) ||
    IGNORE_EXTENSIONS.some((ext) => path.endsWith(ext))
  );
}

function isConfigFile(path: string): boolean {
  return CONFIG_FILE_PATTERN.test(path);
}

function isTestFile(path: string): boolean {
  return TEST_FILE_PATTERN.test(path) || TEST_DIR_PATTERN.test(path);
}

function getSourcePathFromTest(testPath: string): string {
  return testPath
    .replace(/\.(test|spec)(\.[jt]sx?)$/i, "$2")
    .replace(TEST_DIR_PATTERN, "");
}

function boostEntryPointScores(
  files: Array<{ path: string; role: string; score: number }>,
): void {
  for (const file of files) {
    if (file.path.endsWith("index.html") || file.path.endsWith(".html")) {
      file.role  = "entry";
      file.score += 500;
    }
  }
}

function sanitizeDependencyGraph(
  graph: Record<string, string[]>,
): Record<string, string[]> {
  const sanitized: Record<string, string[]> = {};

  for (const [source, targets] of Object.entries(graph)) {
    if (isConfigFile(source)) continue;
    const validTargets = targets.filter((t) => !isConfigFile(t));
    // Keep the source even if it has no valid targets (important for isolated files)
    if (validTargets.length > 0 || targets.length === 0) {
      sanitized[source] = validTargets;
    }
  }

  // Every referenced target must have an entry so downstream consumers never
  // encounter missing keys when walking the graph.
  const allTargets = new Set(Object.values(sanitized).flat());
  for (const target of allTargets) {
    if (!sanitized[target]) sanitized[target] = [];
  }

  return sanitized;
}

function generateTestCoverageMap(allPaths: string[]): TestCoverageMap {
  const coverageMap: TestCoverageMap = {};
  const testFiles: string[] = [];

  for (const path of allPaths) {
    if (isTestFile(path)) {
      testFiles.push(path);
    } else {
      coverageMap[path] = { isTested: false, testFiles: [] };
    }
  }

  for (const testPath of testFiles) {
    const presumedSource = getSourcePathFromTest(testPath);
    const entry = coverageMap[presumedSource];
    if (entry) {
      entry.isTested = true;
      entry.testFiles.push(testPath);
    }
  }

  return coverageMap;
}

function computeCoverageGaps(
  fanIn: Record<string, number>,
  testCoverageMap: TestCoverageMap,
  topN: number,
): CoverageGap[] {
  return Object.entries(fanIn)
    .map(([filePath, fanInScore]) => {
      const coverage = testCoverageMap[filePath] ?? {
        isTested: false,
        testFiles: [],
      };
      return {
        file: filePath,
        fanIn: fanInScore,
        isTested: coverage.isTested,
        testFiles: coverage.testFiles,
        riskScore: coverage.isTested ? 0 : fanInScore,
      };
    })
    .filter((gap) => gap.riskScore > 0)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, topN);
}

/**
 * Validates and coerces the raw `localFiles` payload.
 *
 * Security: strips path-traversal sequences (`../`, `..\`) and leading
 * separators to prevent directory escape attacks on callers that later
 * use these paths for disk operations.
 */
function coerceLocalFiles(raw: unknown[]): FileContent[] {
  return raw
    .filter(
      (f): f is { path: string; content: string } =>
        typeof f === "object" &&
        f !== null &&
        typeof (f as Record<string, unknown>).path === "string" &&
        typeof (f as Record<string, unknown>).content === "string",
    )
    .map((f) => ({
      path: f.path
        .replace(/\.\.[/\\]/g, "")   // strip traversal
        .replace(/^[/\\]+/, ""),     // strip leading separator
      content: f.content,
    }))
    .filter((f) => f.path.length > 0); // discard empty paths after sanitisation
}

// ── Bounded parallel file fetcher ─────────────────────────────────────────────
/**
 * Fetches up to `MAX_FETCH_CONCURRENCY` files in parallel, each with a hard
 * timeout. Failed or timed-out fetches resolve to `null` and are filtered out
 * so a single flaky file never blocks the whole analysis.
 *
 * `Promise.allSettled` is used deliberately — a rejection from one promise
 * must not cancel the others.
 */
async function fetchFilesWithConcurrencyLimit(
  files: Array<{ path: string; role: string }>,
  owner: string,
  repo: string,
  githubToken: string,
): Promise<FileContent[]> {
  const semaphore = new Semaphore(MAX_FETCH_CONCURRENCY);

  const settled = await Promise.allSettled(
    files.map(async (file): Promise<FileContent> => {
      await semaphore.acquire();
      try {
        const raw = await withTimeout(
          fetchFileContent(owner, repo, file.path, githubToken),
          FETCH_TIMEOUT_MS,
        );
        return {
          path: file.path,
          content: raw.split("\n").slice(0, MAX_FILE_LINES).join("\n"),
        };
      } finally {
        // Always release — even if withTimeout throws, so the semaphore
        // doesn't deadlock the remaining promises.
        semaphore.release();
      }
    }),
  );

  return settled
    .filter(
      (r): r is PromiseFulfilledResult<FileContent> => r.status === "fulfilled",
    )
    .map((r) => r.value);
}

// ── Main Pipeline ─────────────────────────────────────────────────────────────
export async function runAstPipeline(
  params: PipelineParams,
): Promise<PipelineResult> {
  const { repoUrl, githubToken, isLocal, localFiles, checkCache } = params;

  let allFileContents: FileContent[]  = [];
  let owner       = "Local";
  let repo        = "Project";
  let commitSha   = "local-upload";
  let description = "Locally uploaded codebase";
  let stars       = 0;
  let language    = "Mixed";
  let filteredPaths: string[]    = [];
  let fileMetrics: FileMetric[]  = [];

  // ── Branch: local upload ───────────────────────────────────────────────────
  if (isLocal && localFiles != null) {
    if (localFiles.length > MAX_LOCAL_FILES) {
      throw new PipelineError(
        "TOO_MANY_FILES",
        `Codebase too large. Max ${MAX_LOCAL_FILES} files.`,
      );
    }

    const coerced  = coerceLocalFiles(localFiles);
    const totalSize = coerced.reduce((acc, f) => acc + f.content.length, 0);

    if (totalSize > MAX_LOCAL_SIZE_BYTES) {
      throw new PipelineError(
        "PAYLOAD_TOO_LARGE",
        `Codebase exceeds ${MAX_LOCAL_SIZE_BYTES / 1_000_000}MB limit.`,
      );
    }

    allFileContents = coerced;
    filteredPaths   = coerced.map((f) => f.path);
    fileMetrics     = coerced.map((f) => ({ path: f.path, size: f.content.length }));

  // ── Branch: GitHub remote ──────────────────────────────────────────────────
  } else {
    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) {
      throw new PipelineError("INVALID_REPO_URL", "Invalid GitHub URL.");
    }

    owner = parsed.owner;
    repo  = parsed.repo;

    const meta = await fetchRepoMeta(owner, repo, githubToken);
    commitSha   = String(meta.default_branch);
    description = String(meta.description    ?? "");
    stars       = Number(meta.stargazers_count ?? 0);
    language    = String(meta.language        ?? "");

    // Cache check — errors here are intentionally swallowed so a cold DB or
    // transient timeout never prevents a fresh analysis from running.
    if (checkCache) {
      try {
        const cached = await checkCache(commitSha);
        if (cached) return { ...cached, cached: true };
      } catch (err) {
        console.warn("[ast-pipeline] Cache check failed, continuing fresh:", err);
      }
    }

    const treeData   = await fetchRepoTree(owner, repo, commitSha, githubToken);
    const validFiles = (
      treeData.tree as Array<{ type: string; path: string; size?: number }>
    ).filter((f) => f.type === "blob" && !isIgnoredFile(f.path));

    filteredPaths = validFiles.map((f) => f.path);
    fileMetrics   = validFiles.map((f) => ({ path: f.path, size: f.size ?? 0 }));

    const scoredFiles = classifyAndScoreFiles(filteredPaths);
    boostEntryPointScores(scoredFiles);
    const topFiles = getTopFiles(scoredFiles, TOP_FILES_FOR_GROQ);

    // Ensure tsconfig is always present for accurate path-alias resolution
    const tsconfigEntry = scoredFiles.find(
      (f) => f.path === "tsconfig.json" || f.path === "src/tsconfig.json",
    );
    if (tsconfigEntry && !topFiles.some((f) => f.path === tsconfigEntry.path)) {
      topFiles.unshift(tsconfigEntry);
    }

    allFileContents = await fetchFilesWithConcurrencyLimit(
      topFiles.slice(0, MAX_FILES_TO_FETCH),
      owner,
      repo,
      githubToken,
    );
  }

  if (allFileContents.length === 0) {
    throw new PipelineError("NO_FILES_FOUND", "No readable code files found.");
  }

  // ── Analysis ───────────────────────────────────────────────────────────────
  // Score the full path list (not just fetched files) for accurate role data.
  // Note: this is a second pass over `filteredPaths` — cheap CPU vs the
  // alternative of threading `scoredFiles` through both branches above.
  const scoredAllFiles = classifyAndScoreFiles(filteredPaths);
  boostEntryPointScores(scoredAllFiles);

  const topFilesForGroq = getTopFiles(scoredAllFiles, TOP_FILES_FOR_GROQ);
  const entryPoints = scoredAllFiles
    .filter((f) => f.role === "entry")
    .slice(0, 5)
    .map((f) => f.path);

  const rawGraph        = buildDependencyGraph(allFileContents, filteredPaths);
  const dependencyGraph = sanitizeDependencyGraph(rawGraph);
  const fanIn           = computeFanIn(dependencyGraph);
  const mermaidDiagram  = graphToMermaid(dependencyGraph, entryPoints);
  const blastRadiusTargets = getBlastRadiusTargets(fanIn, BLAST_RADIUS_TOP_N);

  const fanInValues  = Object.values(fanIn);
  // Guard: Math.max(...[]) returns -Infinity, which would corrupt the health score
  const maxFanIn     = fanInValues.length > 0 ? Math.max(...fanInValues) : 0;
  const largeFilesCount = fileMetrics.filter((f) => f.size > LARGE_FILE_BYTES).length;

  const healthMetrics = calculateHealthGrade({
    totalFiles: filteredPaths.length,
    circularDependencies: 0,
    maxFanIn,
    largeFilesCount,
  });

  const testCoverageMap = generateTestCoverageMap(filteredPaths);
  const coverageGaps    = computeCoverageGaps(fanIn, testCoverageMap, COVERAGE_GAP_TOP_N);

  return {
    owner,
    repo,
    branch: commitSha,
    description,
    stars,
    language,
    totalFiles: filteredPaths.length,
    entryPoints,
    dependencyGraph,
    fanIn,
    mermaidDiagram,
    fileContents: allFileContents.slice(0, MAX_FILES_IN_RESULT),
    fileMetrics,
    healthMetrics,
    testCoverageMap,
    coverageGaps,
    topFilesForGroq: topFilesForGroq.map((f) => ({ path: f.path, role: f.role })),
    blastRadiusTargets: blastRadiusTargets.map((t) => t.file),
    analysis: null,
  };
}