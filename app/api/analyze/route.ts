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

const ANALYSIS_VERSION = 5;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { repoUrl, isLocal, localFiles } = body;

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

        // ✨ THE SHIELD: Check usage limit before spending tokens ✨
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

  let githubToken: string | undefined = undefined;

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

        if (isLocal && localFiles) {
          allFileContents = localFiles;
          filteredPaths = localFiles.map((f: { path: string }) => f.path);

          fileMetrics = localFiles.map((f: { path: string; content: string }) => ({
            path: f.path,
            size: f.content.length 
          }));
        } else {
          const parsed = parseRepoUrl(repoUrl);
          if (!parsed) {
            clearInterval(keepAlive);
            controller.enqueue(encoder.encode(JSON.stringify({ error: "Invalid GitHub URL" })));
            controller.close();
            return;
          }

          owner = parsed.owner;
          repo = parsed.repo;

          const meta = await fetchRepoMeta(owner, repo, githubToken);
          commitSha = meta.default_branch;
          description = meta.description;
          stars = meta.stargazers_count;
          language = meta.language;

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
            controller.enqueue(encoder.encode(JSON.stringify({ ...cached.result_json, cached: true })));
            controller.close();
            return;
          }

          const identifier = userId ? userId : ip;
          const limiter = userId ? ratelimitAuth : ratelimitFree;
          const { success, limit, reset, remaining } = await limiter.limit(identifier);

          if (!success) {
            clearInterval(keepAlive);
            controller.enqueue(encoder.encode(JSON.stringify({ error: "Daily limit reached.", limit, remaining, reset })));
            controller.close();
            return;
          }

          const treeData = await fetchRepoTree(owner, repo, commitSha, githubToken);

          const IGNORE = [
            "node_modules", "dist", "build", ".next", ".git", "coverage", 
            "__pycache__", ".yarn", "vendor", "package-lock.json", 
            "yarn.lock", "pnpm-lock.yaml", "repomix-output.xml" 
          ];
          const IGNORE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".lock", ".min.js", ".map", ".woff", ".woff2"];

          const validFiles = (treeData.tree as { type: string; path: string; size?: number }[])
            .filter((file) => {
              if (file.type !== "blob") return false;
              if (IGNORE.some((ig) => file.path.includes(ig))) return false;
              if (IGNORE_EXTENSIONS.some((ext) => file.path.endsWith(ext))) return false;
              return true;
            });

          filteredPaths = validFiles.map((file) => file.path);
          
          fileMetrics = validFiles.map((file) => ({
            path: file.path,
            size: file.size || 0
          }));
          
          const scoredFiles = classifyAndScoreFiles(filteredPaths);
          scoredFiles.forEach(file => {
            if (file.path.endsWith("index.html") || file.path.endsWith(".html")) {
              file.role = "entry";
              file.score += 500;
            }
          });

          const topFiles = getTopFiles(scoredFiles, 20);

          for (const file of topFiles.slice(0, 30)) {
            try {
              const content = await fetchFileContent(owner, repo, file.path, githubToken);
              const safeContent = content.split("\n").slice(0, 500).join("\n");
              allFileContents.push({ path: file.path, content: safeContent });
            } catch {
              // Silently continue on fetch errors
            }
          }
        }

        if (allFileContents.length === 0) {
          clearInterval(keepAlive);
          controller.enqueue(encoder.encode(JSON.stringify({ error: "No readable code files found." })));
          controller.close();
          return;
        }

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
          allFileContents.slice(0, 15),
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
          fileContents: allFileContents.slice(0, 15),
          fileMetrics
        };

        if (!isLocal) {
          await supabase.from("analyses").insert({
            repo_url: repoUrl,
            repo_name: `${owner}/${repo}`.toLowerCase(),
            commit_sha: commitSha,
            analysis_version: ANALYSIS_VERSION,
            result_json: result,
            user_id: userId
          });

          // ✨ THE TRIGGER: Build the Copilot's memory bank!
          // We await this so the Edge function doesn't kill the process before it finishes.
          await processAndStoreCodebase(supabase, repoUrl, allFileContents);
        }

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
          controller.enqueue(encoder.encode(JSON.stringify({ error: message })));
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