import { NextRequest, NextResponse } from "next/server";
import { parseRepoUrl, fetchRepoMeta, fetchRepoTree, fetchFileContent } from "@/lib/github";
import { classifyAndScoreFiles, getTopFiles } from "@/lib/repo-parser";
import { analyzeWithGemini } from "@/lib/gemini";
import { supabase } from "@/lib/supabase";
import { buildDependencyGraph, computeFanIn, graphToMermaid } from "@/lib/dependency-graph";

const ANALYSIS_VERSION = 2;

export async function POST(req: NextRequest) {
  try {
    const { repoUrl } = await req.json();

    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid GitHub URL" }, { status: 400 });
    }

    const { owner, repo } = parsed;
    const meta = await fetchRepoMeta(owner, repo);
    const commitSha = meta.default_branch;

    // Check cache
    const { data: cached } = await supabase
      .from("analyses")
      .select("result_json, created_at")
      .eq("repo_url", repoUrl)
      .eq("commit_sha", commitSha)
      .eq("analysis_version", ANALYSIS_VERSION)
      .single();

    if (cached) {
      console.log("Cache hit for", repoUrl);
      return NextResponse.json({ ...cached.result_json, cached: true });
    }

    // Fetch file tree
    const treeData = await fetchRepoTree(owner, repo, meta.default_branch);

    const IGNORE = [
      "node_modules", "dist", "build", ".next", ".git",
      "coverage", "__pycache__", ".yarn", "vendor"
    ];

    const IGNORE_EXTENSIONS = [
      ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
      ".lock", ".min.js", ".map", ".woff", ".woff2"
    ];

    const filteredPaths: string[] = treeData.tree
      .filter((file: { path: string; type: string }) => {
        if (file.type !== "blob") return false;
        if (IGNORE.some((ig) => file.path.includes(ig))) return false;
        if (IGNORE_EXTENSIONS.some((ext) => file.path.endsWith(ext))) return false;
        return true;
      })
      .map((file: { path: string }) => file.path);

    // Classify and score files
    const scoredFiles = classifyAndScoreFiles(filteredPaths);
    const topFiles = getTopFiles(scoredFiles, 20);
    const entryPoints = scoredFiles.filter((f) => f.role === "entry").map((f) => f.path);

    // Fetch content of top files
    // Fetch content of top files
const fileContents: { path: string; content: string }[] = [];

for (const file of topFiles.slice(0, 15)) {
  try {
    const content = await fetchFileContent(owner, repo, file.path);
    const lines = content.split("\n").slice(0, 200).join("\n");
    fileContents.push({ path: file.path, content: lines });
  } catch {
    // Skip files that fail
  }
}

    // Build dependency graph — real static analysis
    const dependencyGraph = buildDependencyGraph(fileContents, filteredPaths);
    const fanIn = computeFanIn(dependencyGraph);

    // Boost scores of highly imported files
    const boostedFiles = topFiles.map((f) => ({
      ...f,
      score: f.score + (fanIn[f.path] || 0) * 2,
    })).sort((a, b) => b.score - a.score);

    // Generate Mermaid diagram
    const mermaidDiagram = graphToMermaid(dependencyGraph, entryPoints);

    // Send to Gemini
    const analysis = await analyzeWithGemini(
      `${owner}/${repo}`,
      meta.description || "No description provided",
      entryPoints,
      boostedFiles.map((f) => ({ path: f.path, role: f.role })),
      fileContents
    );

    // Build result
    const result = {
      owner,
      repo,
      branch: meta.default_branch,
      description: meta.description,
      stars: meta.stargazers_count,
      language: meta.language,
      totalFiles: filteredPaths.length,
      entryPoints,
      dependencyGraph,
      fanIn,
      mermaidDiagram,
      analysis,
    };

    // Store in cache
    await supabase.from("analyses").insert({
      repo_url: repoUrl,
      repo_name: `${owner}/${repo}`,
      commit_sha: commitSha,
      analysis_version: ANALYSIS_VERSION,
      result_json: result,
    });

    return NextResponse.json(result);

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}