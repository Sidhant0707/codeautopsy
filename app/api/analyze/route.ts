export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { parseRepoUrl, fetchRepoMeta, fetchRepoTree, fetchFileContent, GitHubAuthError } from "@/lib/github";
import { classifyAndScoreFiles, getTopFiles } from "@/lib/repo-parser";
import { analyzeWithGemini } from "@/lib/gemini";
import { buildDependencyGraph, computeFanIn, graphToMermaid } from "@/lib/dependency-graph";
import { ratelimitAuth, ratelimitFree } from "@/lib/ratelimit";
import { checkUsageLimit } from "@/lib/usage";
import { processAndStoreCodebase } from "@/lib/rag";
import { calculateHealthGrade } from "@/lib/analyzer/health"; 

const ANALYSIS_VERSION = 10;

// ============================================================================
// HELPER FUNCTIONS - Extracted for clarity and reusability
// ============================================================================

const IGNORE_PATTERNS = [
  "node_modules", "dist", "build", ".next", ".git", "coverage", 
  "__pycache__", ".yarn", "vendor", "package-lock.json", 
  "yarn.lock", "pnpm-lock.yaml", "repomix-output.xml"
] as const;

const IGNORE_EXTENSIONS = [
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", 
  ".lock", ".min.js", ".map", ".woff", ".woff2"
] as const;

const CONFIG_FILE_PATTERN = /\.(json|md|ya?ml|config\.(js|mjs|ts|cjs))$/i;
const TEST_FILE_PATTERN = /\.(test|spec)\.[jt]sx?$/i;
const TEST_DIR_PATTERN = /__(tests|mocks)__\//i;

function isIgnoredFile(path: string): boolean {
  return IGNORE_PATTERNS.some(pattern => path.includes(pattern)) ||
         IGNORE_EXTENSIONS.some(ext => path.endsWith(ext));
}

function isConfigFile(path: string): boolean {
  return CONFIG_FILE_PATTERN.test(path);
}

function isTestFile(path: string): boolean {
  return TEST_FILE_PATTERN.test(path) || TEST_DIR_PATTERN.test(path);
}

function getSourcePathFromTest(testPath: string): string {
  return testPath
    .replace(/\.(test|spec)(\.[jt]sx?)$/i, '$2')
    .replace(TEST_DIR_PATTERN, '');
}

function boostEntryPointScores(files: Array<{ path: string; role: string; score: number }>) {
  files.forEach(file => {
    if (file.path.endsWith("index.html") || file.path.endsWith(".html")) {
      file.role = "entry";
      file.score += 500;
    }
  });
}

// ============================================================================
// DEPENDENCY GRAPH SANITIZATION - Fixes React Flow floating node bug
// ============================================================================

function sanitizeDependencyGraph(
  graph: Record<string, string[]>
): Record<string, string[]> {
  const sanitized: Record<string, string[]> = {};
  
  // Step 1: Remove config files as sources and filter them from targets
  for (const [source, targets] of Object.entries(graph)) {
    if (isConfigFile(source)) continue;
    
    const validTargets = targets.filter(t => !isConfigFile(t));
    if (validTargets.length > 0 || targets.length === 0) {
      sanitized[source] = validTargets;
    }
  }
  
  // Step 2: React Flow validation - ensure every referenced target exists as a key
  // This prevents the "floating window" bug where edges point to non-existent nodes
  const allReferencedTargets = new Set<string>();
  for (const targets of Object.values(sanitized)) {
    targets.forEach(t => allReferencedTargets.add(t));
  }
  
  for (const target of allReferencedTargets) {
    if (!sanitized[target]) {
      sanitized[target] = [];
    }
  }
  
  return sanitized;
}

// ============================================================================
// TEST COVERAGE MAP GENERATION - Optimized single-pass algorithm
// ============================================================================

type TestCoverageMap = Record<string, { isTested: boolean; testFiles: string[] }>;

function generateTestCoverageMap(allPaths: string[]): TestCoverageMap {
  const coverageMap: TestCoverageMap = {};
  const testFiles: string[] = [];
  
  // Single pass: separate test files and initialize source files
  for (const path of allPaths) {
    if (isTestFile(path)) {
      testFiles.push(path);
    } else {
      coverageMap[path] = { isTested: false, testFiles: [] };
    }
  }
  
  // Map test files to their sources
  for (const testPath of testFiles) {
    const presumedSource = getSourcePathFromTest(testPath);
    if (coverageMap[presumedSource]) {
      coverageMap[presumedSource].isTested = true;
      coverageMap[presumedSource].testFiles.push(testPath);
    }
  }
  
  return coverageMap;
}

// ============================================================================
// RISK ANALYSIS - Identifies untested high-fan-in files
// ============================================================================

interface CoverageGap {
  file: string;
  fanIn: number;
  isTested: boolean;
  testFiles: string[];
  riskScore: number;
}

function computeCoverageGaps(
  fanIn: Record<string, number>,
  testCoverageMap: TestCoverageMap,
  topN: number = 10
): CoverageGap[] {
  return Object.entries(fanIn)
    .map(([filePath, fanInScore]) => {
      const coverageData = testCoverageMap[filePath] || { isTested: false, testFiles: [] };
      const riskScore = coverageData.isTested ? 0 : fanInScore;
      
      return {
        file: filePath,
        fanIn: fanInScore,
        isTested: coverageData.isTested,
        testFiles: coverageData.testFiles,
        riskScore
      };
    })
    .filter(gap => gap.riskScore > 0)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, topN);
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { repoUrl, isLocal, localFiles } = body;

  const cookieStore = await cookies();
  const headerList = await headers();

  const ip = headerList.get("x-forwarded-for")?.split(",")[0] ||
             headerList.get("x-real-ip") ||
             "127.0.0.1";

  // Initialize Supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options?: Parameters<typeof cookieStore.set>[2]) {
          cookieStore.set(name, value, options);
        },
        remove(name: string) {
          cookieStore.delete(name);
        }
      }
    }
  );

  // Auth and rate limit check
  let session = null;
  let authUser = null;

  try {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    session = currentSession;

    if (session) {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (!userError && user) {
        authUser = user;

        const isUnderLimit = await checkUsageLimit(supabase, user.id, user.email);
        if (!isUnderLimit) {
          return NextResponse.json(
            { 
              error: "RATE_LIMIT_REACHED", 
              message: "Daily limit of 10 scans reached. Please upgrade to the Architect tier to continue." 
            }, 
            { status: 429 }
          );
        }
      } else {
        session = null;
      }
    }
  } catch (error) {
    console.error("Auth/Rate Limit Error:", error);
  }

  const userId = authUser?.id ?? undefined;
  const provider = authUser?.app_metadata?.provider;

  // GitHub token resolution
  let githubToken: string | undefined;

  if (provider === 'github' && session?.provider_token) {
    githubToken = session.provider_token;
  } else if (!process.env.GITHUB_FALLBACK_TOKEN) {
    return NextResponse.json(
      { error: "Server configuration error: Missing GitHub fallback token." },
      { status: 500 }
    );
  } else {
    githubToken = process.env.GITHUB_FALLBACK_TOKEN;
  }

  const encoder = new TextEncoder();

  // Streaming response
  const stream = new ReadableStream({
    async start(controller) {
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(" "));
        } catch {
          clearInterval(keepAlive);
        }
      }, 2000);

      try {
        let allFileContents: { path: string; content: string }[] = [];
        let owner = "Local";
        let repo = "Project";
        let commitSha = "local-upload";
        let description = "Locally uploaded codebase";
        let stars = 0;
        let language = "Mixed";
        let filteredPaths: string[] = [];
        let fileMetrics: { path: string; size: number }[] = [];

        // ====================================================================
        // LOCAL VS GITHUB BRANCH
        // ====================================================================

        if (isLocal && localFiles) {
          allFileContents = localFiles;
          filteredPaths = localFiles.map((f: { path: string }) => f.path);
          fileMetrics = localFiles.map((f: { path: string; content: string }) => ({
            path: f.path,
            size: f.content.length 
          }));
        } else {
          // GitHub repository analysis
          const parsed = parseRepoUrl(repoUrl);
          if (!parsed) {
            clearInterval(keepAlive);
            controller.enqueue(encoder.encode(JSON.stringify({ error: "Invalid GitHub URL" })));
            controller.close();
            return;
          }

          owner = parsed.owner;
          repo = parsed.repo;

          // Fetch repo metadata
          const meta = await fetchRepoMeta(owner, repo, githubToken);
          commitSha = String(meta.default_branch);
          description = String(meta.description ?? "");
          stars = Number(meta.stargazers_count ?? 0);
          language = String(meta.language ?? "");

          // Check cache
          const { data: cached } = await supabase
            .from("analyses")
            .select("result_json")
            .eq("repo_url", repoUrl)
            .eq("commit_sha", commitSha)
            .eq("analysis_version", ANALYSIS_VERSION)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (cached?.result_json) {
            clearInterval(keepAlive);
            controller.enqueue(encoder.encode(JSON.stringify({ 
              ...cached.result_json, 
              cached: true 
            })));
            controller.close();
            return;
          }

          // Rate limiting
          const identifier = userId ?? ip;
          const limiter = userId ? ratelimitAuth : ratelimitFree;
          const { success, limit, reset, remaining } = await limiter.limit(identifier);

          if (!success) {
            clearInterval(keepAlive);
            controller.enqueue(encoder.encode(JSON.stringify({ 
              error: "RATE_LIMIT_REACHED", 
              message: "24-hour sliding window limit reached. Please try again later or upgrade for higher limits.",
              limit, 
              remaining, 
              reset 
            })));
            controller.close();
            return;
          }

          // Fetch repo tree
          const treeData = await fetchRepoTree(owner, repo, commitSha, githubToken);

          // Filter valid files with optimized single-pass
          const validFiles = (treeData.tree as { type: string; path: string; size?: number }[])
            .filter(file => file.type === "blob" && !isIgnoredFile(file.path));

          filteredPaths = validFiles.map(file => file.path);
          fileMetrics = validFiles.map(file => ({
            path: file.path,
            size: file.size || 0
          }));
          
          // Score and classify files
          const scoredFiles = classifyAndScoreFiles(filteredPaths);
          boostEntryPointScores(scoredFiles);

          const topFiles = getTopFiles(scoredFiles, 20);

          // Ensure tsconfig.json is included for alias resolution
          const tsconfigEntry = scoredFiles.find(f => 
            f.path === "tsconfig.json" || f.path === "src/tsconfig.json"
          );
          if (tsconfigEntry && !topFiles.find(f => f.path === tsconfigEntry.path)) {
            topFiles.unshift(tsconfigEntry);
          }

          // Fetch file contents (limit to first 500 lines per file)
          const fetchPromises = topFiles.slice(0, 30).map(async file => {
            try {
              const content = await fetchFileContent(owner, repo, file.path, githubToken);
              const safeContent = content.split("\n").slice(0, 500).join("\n");
              return { path: file.path, content: safeContent };
            } catch {
              return null;
            }
          });

          const results = await Promise.all(fetchPromises);
          allFileContents = results.filter((r): r is { path: string; content: string } => r !== null);
        }

        // ====================================================================
        // EARLY EXIT: No readable files
        // ====================================================================

        if (allFileContents.length === 0) {
          clearInterval(keepAlive);
          controller.enqueue(encoder.encode(JSON.stringify({ 
            error: "No readable code files found." 
          })));
          controller.close();
          return;
        }

        // ====================================================================
        // CORE ANALYSIS PIPELINE
        // ====================================================================

        // Re-score all files for analysis (includes entry point boosting)
        const scoredAllFiles = classifyAndScoreFiles(filteredPaths);
        boostEntryPointScores(scoredAllFiles);

        const topFilesForGroq = getTopFiles(scoredAllFiles, 20);
        const entryPoints = scoredAllFiles
          .filter(f => f.role === "entry")
          .slice(0, 5)
          .map(f => f.path);

        // Build dependency graph
        const rawDependencyGraph = buildDependencyGraph(allFileContents, filteredPaths);
        
        // 🔧 FIX: Sanitize graph to prevent React Flow floating window bug
        const dependencyGraph = sanitizeDependencyGraph(rawDependencyGraph);
        
        const fanIn = computeFanIn(dependencyGraph);
        const mermaidDiagram = graphToMermaid(dependencyGraph, entryPoints);

        // Blast radius analysis
        const { getBlastRadiusTargets } = await import("@/lib/dependency-graph");
        const blastRadiusTargets = getBlastRadiusTargets(fanIn, 3);
        
        // Health metrics
        const fanInValues = Object.values(fanIn) as number[];
        const maxFanInValue = fanInValues.length > 0 ? Math.max(...fanInValues) : 0;
        const largeFilesCount = fileMetrics.filter(f => f.size > 15000).length;
        
        const healthMetrics = calculateHealthGrade({
          totalFiles: filteredPaths.length,
          circularDependencies: 0,
          maxFanIn: maxFanInValue,
          largeFilesCount
        });

        // LLM analysis
        const analysis = await analyzeWithGemini(
          `${owner}/${repo}`,
          description || "No description provided",
          entryPoints,
          topFilesForGroq.map(f => ({ path: f.path, role: f.role })),
          allFileContents.slice(0, 15),
          blastRadiusTargets,
          healthMetrics 
        );

        // 🧪 Test Coverage Analysis (Sprint 4)
        const testCoverageMap = generateTestCoverageMap(filteredPaths);
        const coverageGaps = computeCoverageGaps(fanIn, testCoverageMap, 10);

        console.log("🧪 [Sprint 4] Test Coverage Map Generated!");
        console.log("💣 [Sprint 4] Coverage Gaps Computed:", coverageGaps.length);

        // ====================================================================
        // ASSEMBLE RESULT
        // ====================================================================

        const result = {
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
          analysis,
          fileContents: allFileContents.slice(0, 15),
          fileMetrics,
          healthMetrics,
          testCoverageMap,
          coverageGaps
        };

        // Persist to database (GitHub repos only)
        if (!isLocal) {
          await supabase.from("analyses").insert({
            repo_url: repoUrl,
            repo_name: `${owner}/${repo}`.toLowerCase(),
            commit_sha: commitSha,
            analysis_version: ANALYSIS_VERSION,
            result_json: result,
            user_id: userId
          });
          
          await processAndStoreCodebase(supabase, repoUrl, allFileContents);
        }

        // Send result and close stream
        clearInterval(keepAlive);
        controller.enqueue(encoder.encode(JSON.stringify(result)));
        controller.close();

      } catch (err) {
        clearInterval(keepAlive);
        const message = err instanceof Error ? err.message : "Unknown error";
        
        if (err instanceof GitHubAuthError || message === 'REQUIRE_GITHUB_AUTH') {
          controller.enqueue(encoder.encode(JSON.stringify({ 
            error: 'REQUIRE_GITHUB_AUTH',
            message: 'This repository requires GitHub authentication. Please sign in with GitHub to analyze private repositories.'
          })));
        } else {
          console.error("Analysis error:", err);
          controller.enqueue(encoder.encode(JSON.stringify({ 
            error: message 
          })));
        }
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}