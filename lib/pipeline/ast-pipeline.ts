// lib/pipeline/ast-pipeline.ts

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
  getBlastRadiusTargets,
} from "@/lib/dependency-graph";
import { calculateHealthGrade } from "@/lib/analyzer/health";

const IGNORE_PATTERNS = [
  "node_modules", "dist", "build", ".next", ".git", "coverage",
  "__pycache__", ".yarn", "vendor", "package-lock.json", "yarn.lock",
  "pnpm-lock.yaml", "repomix-output.xml",
] as const;

const IGNORE_EXTENSIONS = [
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
  ".lock", ".min.js", ".map", ".woff", ".woff2",
] as const;

const CONFIG_FILE_PATTERN = /\.(json|md|ya?ml|config\.(js|mjs|ts|cjs))$/i;
const TEST_FILE_PATTERN   = /\.(test|spec)\.[jt]sx?$/i;
const TEST_DIR_PATTERN    = /__(tests|mocks)__\//i;

const MAX_LOCAL_FILES       = 300;
const MAX_LOCAL_SIZE_BYTES  = 2_000_000;
const MAX_FETCH_CONCURRENCY = 6;
const FETCH_TIMEOUT_MS      = 8_000;
const MAX_FILE_LINES        = 500;
const MAX_FILES_TO_FETCH    = 30;
const MAX_FILES_IN_RESULT   = 15;
const LARGE_FILE_BYTES      = 15_000;
const BLAST_RADIUS_TOP_N    = 3;
const COVERAGE_GAP_TOP_N    = 10;
const TOP_FILES_FOR_GROQ    = 20;

const PAGERANK_ITERATIONS     = 20;
const PAGERANK_DAMPING_FACTOR = 0.85;
const PAGERANK_WEIGHT         = 0.7;
const FANIN_WEIGHT            = 0.3;

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
    this.name = "PipelineError";
    this.code = code;
    Object.setPrototypeOf(this, PipelineError.prototype);
  }
}

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
  pageRankScore: number;
}

export type TestCoverageMap = Record<string, { isTested: boolean; testFiles: string[] }>;
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
  pageRankScores: Record<string, number>;
  analysis: null;
  cached?: true;
}

export interface PipelineParams {
  repoUrl: string;
  githubToken: string;
  isLocal?: boolean;
  localFiles?: unknown[];
  checkCache?: (commitSha: string) => Promise<PipelineResult | null | undefined>;
}

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
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.permits++;
    }
  }
}

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
      file.role   = "entry";
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
    if (validTargets.length > 0 || targets.length === 0) {
      sanitized[source] = validTargets;
    }
  }

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

function truncateToLines(text: string, maxLines: number): string {
  let lineCount = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") {
      lineCount++;
      if (lineCount === maxLines) {
        return text.substring(0, i + 1);
      }
    }
  }
  return text;
}

function computePageRank(
  graph: Record<string, string[]>,
  iterations = PAGERANK_ITERATIONS,
  dampingFactor = PAGERANK_DAMPING_FACTOR,
): Record<string, number> {
  const nodes = Object.keys(graph);
  const N = nodes.length;
  if (N === 0) return {};

  const reverseGraph: Record<string, string[]> = {};
  for (const node of nodes) reverseGraph[node] = [];

  for (const [src, targets] of Object.entries(graph)) {
    for (const target of targets) {
      if (!reverseGraph[target]) reverseGraph[target] = [];
      reverseGraph[target].push(src);
    }
  }

  let rank: Record<string, number> = {};
  for (const node of nodes) rank[node] = 1 / N;

  for (let i = 0; i < iterations; i++) {
    let danglingMass = 0;
    for (const node of nodes) {
      if ((graph[node]?.length ?? 0) === 0) {
        danglingMass += rank[node];
      }
    }

    const next: Record<string, number> = {};
    for (const node of nodes) {
      let incoming = 0;
      for (const src of reverseGraph[node] ?? []) {
        const outDegree = graph[src]?.length;
        if (outDegree) {
          incoming += rank[src] / outDegree;
        }
      }
      next[node] =
        (1 - dampingFactor) / N +
        dampingFactor * (incoming + danglingMass / N);
    }
    rank = next;
  }

  const values = Object.values(rank);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  const normalized: Record<string, number> = {};
  for (const [node, r] of Object.entries(rank)) {
    normalized[node] = Math.round(((r - min) / range) * 100);
  }

  return normalized;
}

function computeCoverageGaps(
  fanIn: Record<string, number>,
  testCoverageMap: TestCoverageMap,
  topN: number,
  pageRank: Record<string, number>,
): CoverageGap[] {
  return Object.entries(fanIn)
    .map(([filePath, fanInScore]) => {
      const coverage = testCoverageMap[filePath] ?? {
        isTested: false,
        testFiles: [],
      };

      const pr = pageRank[filePath] ?? 0;
      const rawScore = pr * PAGERANK_WEIGHT + fanInScore * FANIN_WEIGHT;
      const riskScore = coverage.isTested ? 0 : Math.round(rawScore);

      return {
        file: filePath,
        fanIn: fanInScore,
        isTested: coverage.isTested,
        testFiles: coverage.testFiles,
        riskScore,
        pageRankScore: pr,
      };
    })
    .filter((gap) => gap.riskScore > 0)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, topN);
}

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
        .replace(/\.\.[/\\]/g, "")
        .replace(/^[/\\]+/, ""),
      content: f.content,
    }))
    .filter((f) => f.path.length > 0);
}

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
          content: truncateToLines(raw, MAX_FILE_LINES),
        };
      } finally {
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

export async function runAstPipeline(
  params: PipelineParams,
): Promise<PipelineResult> {
  const { repoUrl, githubToken, isLocal, localFiles, checkCache } = params;

  let allFileContents: FileContent[] = [];
  let owner       = "Local";
  let repo        = "Project";
  let commitSha   = "local-upload";
  let description = "Locally uploaded codebase";
  let stars       = 0;
  let language    = "Mixed";
  let filteredPaths: string[]   = [];
  let fileMetrics: FileMetric[] = [];

  if (isLocal && localFiles != null) {
    if (localFiles.length > MAX_LOCAL_FILES) {
      throw new PipelineError(
        "TOO_MANY_FILES",
        `Codebase too large. Max ${MAX_LOCAL_FILES} files.`,
      );
    }

    const coerced   = coerceLocalFiles(localFiles);
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

  } else {
    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) {
      throw new PipelineError("INVALID_REPO_URL", "Invalid GitHub URL.");
    }

    owner = parsed.owner;
    repo  = parsed.repo;

    const meta  = await fetchRepoMeta(owner, repo, githubToken);
    commitSha   = String(meta.default_branch);
    description = String(meta.description      ?? "");
    stars       = Number(meta.stargazers_count  ?? 0);
    language    = String(meta.language          ?? "");

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

  const fanInValues = Object.values(fanIn);
  const maxFanIn    = fanInValues.length > 0 ? Math.max(...fanInValues) : 0;
  const largeFilesCount = fileMetrics.filter((f) => f.size > LARGE_FILE_BYTES).length;

  const healthMetrics = calculateHealthGrade({
    totalFiles: filteredPaths.length,
    circularDependencies: 0,
    maxFanIn,
    largeFilesCount,
  });

  const testCoverageMap = generateTestCoverageMap(filteredPaths);
  const pageRankScores  = computePageRank(dependencyGraph);
  const coverageGaps    = computeCoverageGaps(
    fanIn,
    testCoverageMap,
    COVERAGE_GAP_TOP_N,
    pageRankScores,
  );

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
    pageRankScores,
    analysis: null,
  };
}