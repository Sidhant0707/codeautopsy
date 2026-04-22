import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { parseRepoUrl, fetchRepoMeta, fetchRepoTree, fetchFileContent } from "@/lib/github";
import { classifyAndScoreFiles, getTopFiles } from "@/lib/repo-parser";
import { analyzeWithGemini } from "@/lib/gemini";
import { buildDependencyGraph, computeFanIn, graphToMermaid } from "@/lib/dependency-graph";
import { ratelimit } from "@/lib/ratelimit";

const ANALYSIS_VERSION = 2;

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
      set(name: string, value: string, options: any) {
        cookieStore.set(name, value, options);
      },
      remove(name: string) {
        cookieStore.delete(name);
      }
    }
  }
);

const { data: { session } } = await supabase.auth.getSession();

const providerToken = session?.provider_token ?? undefined;
const userId = session?.user?.id ?? undefined;

const { repoUrl } = await req.json();

const parsed = parseRepoUrl(repoUrl);

if (!parsed) {
  return NextResponse.json({ error: "Invalid GitHub URL" }, { status: 400 });
}

const { owner, repo } = parsed;

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
const { success, limit, reset, remaining } = await ratelimit.limit(ip);

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

    const filteredPaths: string[] = treeData.tree
      .filter((file: any) => {
        if (file.type !== "blob") return false;
        if (IGNORE.some((ig) => file.path.includes(ig))) return false;
        if (IGNORE_EXTENSIONS.some((ext) => file.path.endsWith(ext))) return false;
        return true;
      })
      .map((file: any) => file.path);

    const scoredFiles = classifyAndScoreFiles(filteredPaths);

    scoredFiles.forEach(file => {
      if (file.path.endsWith("index.html") || file.path.endsWith(".html")) {
        file.role = "entry";
        file.score += 500;
      }
    });

    const topFiles = getTopFiles(scoredFiles, 20);
    const entryPoints = scoredFiles.filter((f) => f.role === "entry").map((f) => f.path);

    const fileContents: { path: string; content: string }[] = [];

    for (const file of topFiles.slice(0, 15)) {
      try {
        const content = await fetchFileContent(owner, repo, file.path, providerToken);
        fileContents.push({
          path: file.path,
          content: content.split("\n").slice(0, 500).join("\n")
        });
      } catch {}
    }

    const dependencyGraph = buildDependencyGraph(fileContents, filteredPaths);
    const fanIn = computeFanIn(dependencyGraph);
    const mermaidDiagram = graphToMermaid(dependencyGraph, entryPoints);

    const analysis = await analyzeWithGemini(
      `${owner}/${repo}`,
      meta.description || "No description provided",
      entryPoints,
      topFiles.map((f) => ({ path: f.path, role: f.role })),
      fileContents
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
      analysis
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
    return NextResponse.json({ error: message }, { status: 500 });
  }
}