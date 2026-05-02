export const maxDuration = 60;

import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { parseRepoUrl, fetchRepoMeta, fetchRepoTree, fetchFileContent, GitHubAuthError } from "@/lib/github";
import { classifyAndScoreFiles, getTopFiles } from "@/lib/repo-parser";
import { analyzeWithGemini } from "@/lib/gemini";
import { buildDependencyGraph, computeFanIn, graphToMermaid } from "@/lib/dependency-graph";
import { ratelimitAuth, ratelimitFree } from "@/lib/ratelimit";

const ANALYSIS_VERSION = 3;

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const headerList = await headers();

    const ip =
      headerList.get("x-forwarded-for")?.split(",")[0] ||
      headerList.get("x-real-ip") ||
      "127.0.0.1";

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

    let session = null;
    let authUser = null;

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      session = currentSession;

      if (session) {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (!userError && user) {
          authUser = user;
        } else {
          session = null;
        }
      }
    } catch (error) {
      console.warn("Supabase auth check failed. Proceeding as guest.", error);
    }

    const userId = authUser?.id ?? undefined;
    const provider = authUser?.app_metadata?.provider;

    // 🚨 SMART TOKEN ROUTING
    let githubToken: string | undefined = undefined;

    if (provider === 'github' && session?.provider_token) {
      githubToken = session.provider_token;
    } else if (!process.env.GITHUB_FALLBACK_TOKEN) {
      console.error("CRITICAL: Missing GITHUB_FALLBACK_TOKEN in environment variables.");
      return NextResponse.json(
        { error: "Server configuration error: Missing GitHub fallback token." },
        { status: 500 }
      );
    } else {
      githubToken = process.env.GITHUB_FALLBACK_TOKEN;
    }

    const body = await req.json();
    const { repoUrl, isLocal, localFiles } = body;

    // Shared variables for the Unified Pipeline
    let allFileContents: { path: string; content: string }[] = [];
    let owner = "Local";
    let repo = "Project";
    let commitSha = "local-upload";
    let description = "Locally uploaded codebase";
    let stars = 0;
    let language = "Mixed";
    let filteredPaths: string[] = [];

    // ==========================================
    // FLOW A: LOCAL .ZIP UPLOAD
    // ==========================================
    if (isLocal && localFiles) {
      console.log("Processing Local ZIP payload...");
      allFileContents = localFiles;
      filteredPaths = localFiles.map((f: { path: string }) => f.path);
      
    // ==========================================
    // FLOW B: GITHUB REPOSITORY
    // ==========================================
    } else {
      console.log("Processing GitHub URL...");
      
      const parsed = parseRepoUrl(repoUrl);
      if (!parsed) {
        return NextResponse.json({ error: "Invalid GitHub URL" }, { status: 400 });
      }

      // Reassign without redeclaring
      owner = parsed.owner;
      repo = parsed.repo;

      const meta = await fetchRepoMeta(owner, repo, githubToken);
      commitSha = meta.default_branch;
      description = meta.description;
      stars = meta.stargazers_count;
      language = meta.language;

      // ✅ CHECK CACHE FIRST (before rate limiting)
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
        return NextResponse.json({ ...cached.result_json, cached: true });
      }

      // ✅ RATE LIMITING
      const identifier = userId ? userId : ip;
      const limiter = userId ? ratelimitAuth : ratelimitFree;
      const { success, limit, reset, remaining } = await limiter.limit(identifier);

      if (!success) {
        return NextResponse.json(
          { error: "Daily limit reached.", limit, remaining, reset },
          { status: 429 }
        );
      }

      const treeData = await fetchRepoTree(owner, repo, commitSha, githubToken);

      const IGNORE = ["node_modules", "dist", "build", ".next", ".git", "coverage", "__pycache__", ".yarn", "vendor"];
      const IGNORE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".lock", ".min.js", ".map", ".woff", ".woff2"];

      filteredPaths = (treeData.tree as { type: string; path: string }[])
        .filter((file) => {
          if (file.type !== "blob") return false;
          if (IGNORE.some((ig) => file.path.includes(ig))) return false;
          if (IGNORE_EXTENSIONS.some((ext) => file.path.endsWith(ext))) return false;
          return true;
        })
        .map((file) => file.path);

      const scoredFiles = classifyAndScoreFiles(filteredPaths);
      scoredFiles.forEach(file => {
        if (file.path.endsWith("index.html") || file.path.endsWith(".html")) {
          file.role = "entry";
          file.score += 500;
        }
      });

      const topFiles = getTopFiles(scoredFiles, 20);

      let fetchErrors = 0;
      for (const file of topFiles.slice(0, 30)) {
        try {
          const content = await fetchFileContent(owner, repo, file.path, githubToken);
          const safeContent = content.split("\n").slice(0, 500).join("\n");
          allFileContents.push({ path: file.path, content: safeContent });
        } catch (err) {
          fetchErrors++;
          console.warn(`Failed to fetch ${file.path}:`, err);
        }
      }

      if (fetchErrors > 10) {
        console.error(`Warning: Failed to fetch ${fetchErrors} files`);
      }
    } // <-- END OF FLOW B (GITHUB)

    // ==========================================
    // THE UNIFIED AI PIPELINE
    // ==========================================
    if (allFileContents.length === 0) {
      return NextResponse.json({ error: "No readable code files found." }, { status: 400 });
    }

    // Run scoring on the combined/local files to find entry points for the AI
    const scoredAllFiles = classifyAndScoreFiles(filteredPaths);
    scoredAllFiles.forEach(file => {
      if (file.path.endsWith("index.html") || file.path.endsWith(".html")) {
        file.role = "entry";
        file.score += 500;
      }
    });

    const topFilesForGroq = getTopFiles(scoredAllFiles, 20);
    const entryPoints = scoredAllFiles.filter((f) => f.role === "entry").map((f) => f.path);

    const dependencyGraph = buildDependencyGraph(allFileContents, filteredPaths);
    const fanIn = computeFanIn(dependencyGraph);
    const mermaidDiagram = graphToMermaid(dependencyGraph, entryPoints);

    const { getBlastRadiusTargets } = await import("@/lib/dependency-graph");
    const blastRadiusTargets = getBlastRadiusTargets(fanIn, 3);

    const analysis = await analyzeWithGemini(
      `${owner}/${repo}`,
      description || "No description provided",
      entryPoints,
      topFilesForGroq.map((f) => ({ path: f.path, role: f.role })),
      allFileContents.slice(0, 15),  // Use first 15 for Groq
      blastRadiusTargets
    );

    const result = {
      owner,
      repo,
      branch: commitSha,
      description: description,
      stars: stars,
      language: language,
      totalFiles: filteredPaths.length,
      entryPoints,
      dependencyGraph,
      fanIn,
      mermaidDiagram,
      analysis,
      fileContents: allFileContents.slice(0, 15)
    };

    // Only cache to Supabase if it's a GitHub repo (we don't want to save private local zips to DB)
    if (!isLocal) {
      await supabase.from("analyses").insert({
        repo_url: repoUrl,
        repo_name: `${owner}/${repo}`.toLowerCase(),
        commit_sha: commitSha,
        analysis_version: ANALYSIS_VERSION,
        result_json: result,
        user_id: userId
      });
    }

    return NextResponse.json(result);

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (err instanceof GitHubAuthError || message === 'REQUIRE_GITHUB_AUTH') {
      return NextResponse.json(
        { 
          error: 'REQUIRE_GITHUB_AUTH',
          message: 'This repository requires GitHub authentication. Please sign in with GitHub to analyze private repositories.'
        },
        { status: 403 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}