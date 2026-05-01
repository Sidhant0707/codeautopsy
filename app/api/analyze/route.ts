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

    try {
      // Try to get the session. If the token is dead and refresh fails, 
      // it will throw an AuthApiError, which we will now catch.
      const { data } = await supabase.auth.getSession();
      session = data?.session;
    } catch (error) {
      console.warn("Supabase auth session dead or unrefreshable. Proceeding as unauthenticated guest.", error);
    }

    const providerToken = session?.provider_token ?? undefined;
    const userId = session?.user?.id ?? undefined;
    const provider = session?.user?.app_metadata?.provider;

    const body = await req.json();
    const { repoUrl } = body;

    if (!repoUrl || typeof repoUrl !== 'string') {
      return NextResponse.json({ error: "Missing or invalid repoUrl" }, { status: 400 });
    }

    const parsed = parseRepoUrl(repoUrl);

    if (!parsed) {
      return NextResponse.json({ error: "Invalid GitHub URL" }, { status: 400 });
    }

    const { owner, repo } = parsed;

    if (provider === 'google' && !providerToken) {
  // If we detect a potential private repo or just want to warn
  console.log("User is on Google Auth, private repos will fail 404/403.");
}

    const meta = await fetchRepoMeta(owner, repo, providerToken);
    const commitSha = meta.default_branch;

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

    // ✅ ONLY rate limit if cache miss
    const identifier = userId ? userId : ip;
    const limiter = userId ? ratelimitAuth : ratelimitFree;
    
    const { success, limit, reset, remaining } = await limiter.limit(identifier);

    if (!success) {
      return NextResponse.json(
        { error: "Daily limit reached.", limit, remaining, reset },
        { status: 429 }
      );
    }

    const treeData = await fetchRepoTree(owner, repo, commitSha, providerToken);

    const IGNORE = [
      "node_modules",
      "dist",
      "build",
      ".next",
      ".git",
      "coverage",
      "__pycache__",
      ".yarn",
      "vendor"
    ];

    const IGNORE_EXTENSIONS = [
      ".png",
      ".jpg",
      ".jpeg",
      ".gif",
      ".svg",
      ".ico",
      ".lock",
      ".min.js",
      ".map",
      ".woff",
      ".woff2"
    ];

    type RepoTreeItem = { type: string; path: string };

    const filteredPaths: string[] = (treeData.tree as RepoTreeItem[])
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
    const entryPoints = scoredFiles.filter((f) => f.role === "entry").map((f) => f.path);

    // Fetch top 30 files once
    const allFileContents: { path: string; content: string }[] = [];

    let fetchErrors = 0;
    for (const file of topFiles.slice(0, 30)) {
      try {
        const content = await fetchFileContent(owner, repo, file.path, providerToken);
        
        // MINIFICATION FIX: Strip whitespace and comments so Groq doesn't choke on tokens
        const minifiedContent = content
          .split("\n")
          .map(line => line.trim())
          .filter(line => 
            line.length > 0 && 
            !line.startsWith("//") && 
            !line.startsWith("/*") && 
            !line.startsWith("*")
          )
          .slice(0, 300) // Keeps the top 300 meaningful lines
          .join("\n");

        allFileContents.push({
          path: file.path,
          content: minifiedContent
        });
      } catch (err) {
        fetchErrors++;
        console.warn(`Failed to fetch ${file.path}:`, err);
      }
    }

    // If too many failures, warn the user
    if (fetchErrors > 10) {
      console.error(`Warning: Failed to fetch ${fetchErrors} files`);
    }

    const dependencyGraph = buildDependencyGraph(allFileContents, filteredPaths);
    const fanIn = computeFanIn(dependencyGraph);
    const mermaidDiagram = graphToMermaid(dependencyGraph, entryPoints);

    const analysis = await analyzeWithGemini(
      `${owner}/${repo}`,
      meta.description || "No description provided",
      entryPoints,
      topFiles.map((f) => ({ path: f.path, role: f.role })),
      allFileContents.slice(0, 15)  // Use first 15 for Groq
    );

    const result = {
      owner,
      repo,
      branch: commitSha,
      description: meta.description,
      stars: meta.stargazers_count,
      language: meta.language,
      totalFiles: filteredPaths.length,
      entryPoints,
      dependencyGraph,
      fanIn,
      mermaidDiagram,
      analysis,
      fileContents: allFileContents.slice(0, 15)
    };

    await supabase.from("analyses").insert({
      repo_url: repoUrl,
      repo_name: `${owner}/${repo}`.toLowerCase(),
      commit_sha: commitSha,
      analysis_version: ANALYSIS_VERSION,
      result_json: result,
      user_id: userId
    });

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