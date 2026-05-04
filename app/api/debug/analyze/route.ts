import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { parseStackTrace, extractErrorInfo } from "@/lib/debug/stack-parser";
import { traverseFromCrash } from "@/lib/debug/graph-traversal";
import { analyzeDebugWithGemini } from "@/lib/debug/gemini-debug";
import { highlightDebugPath } from "@/lib/debug/mermaid-highlighter";
import { fetchMissingFiles, extractLineContext } from "@/lib/debug/file-fetcher";
import { getCachedDebug, cacheDebug, hashStackTrace } from "@/lib/debug/cache";
import { applyDebugHeuristics, calculateConfidence, requiresRuntimeCheck } from "@/lib/debug/heuristics";
import { parseRepoUrl } from "@/lib/github";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    let userId = undefined;
    let providerToken = undefined;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id;
      
      const { data: { session } } = await supabase.auth.getSession();
      providerToken = session?.provider_token ?? undefined;
    } catch {
    }

    const body = await req.json();

    const { repoUrl, stackTrace } = body;

    if (!repoUrl || !stackTrace || stackTrace.trim() === "") {
      return NextResponse.json(
        { error: `Missing data. Received repoUrl: ${!!repoUrl}, stackTrace: ${!!stackTrace}` },
        { status: 400 }
      );
    }

    const { error_type, error_message } = extractErrorInfo(stackTrace);

    const traceHash = hashStackTrace(stackTrace);
    const cached = await getCachedDebug(repoUrl, traceHash);
    
    if (cached) {
      return NextResponse.json({ ...cached, cached: true });
    }

    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid GitHub URL" }, { status: 400 });
    }

    const { owner, repo } = parsed;

    const { data: analysis, error: dbError } = await supabase
      .from("analyses")
      .select("*")
      .eq("repo_url", repoUrl)
      .eq("analysis_version", 3)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dbError) {
      return NextResponse.json(
        { error: "Failed to fetch analysis from database" },
        { status: 500 }
      );
    }

    if (!analysis || !analysis.result_json) {
      return NextResponse.json(
        { error: "Repository not analyzed yet. Please analyze it first." },
        { status: 404 }
      );
    }

    const { result_json } = analysis;
    const { dependencyGraph, fanIn, mermaidDiagram } = result_json;

    const allFiles = Object.keys(dependencyGraph);

    const crashNode = parseStackTrace(stackTrace, allFiles);

    if (!crashNode) {
      return NextResponse.json(
        { error: "Could not extract crash location from stack trace. Make sure the file exists in the analyzed repository." },
        { status: 400 }
      );
    }

    let traversalPath = traverseFromCrash(
      crashNode.file,
      dependencyGraph,
      fanIn
    );

    traversalPath = applyDebugHeuristics(traversalPath, error_type);

    const fileContents = result_json.fileContents || [];
    const existingContents = new Map<string, string>(
      fileContents.map((f: { path: string; content: string }) => [f.path, f.content])
    );

    const allContents = await fetchMissingFiles(
      traversalPath,
      existingContents,
      owner,
      repo,
      providerToken
    );

    const relevantCode = traversalPath.slice(0, 10).map((node) => {
      const content = allContents.get(node.file) || "";
      const is_crash_site = node.file === crashNode.file;

      let finalContent = "";
      if (is_crash_site) {
        finalContent = extractLineContext(content, crashNode.line).snippet;
      } else {
        finalContent = content
          .split("\n")
          .map(line => line.trim())
          .filter(line => 
            line.length > 0 && 
            !line.startsWith("//") && 
            !line.startsWith("/*") && 
            !line.startsWith("*")
          )
          .slice(0, 300)
          .join("\n");
      }

      let line_context = undefined;
      if (is_crash_site) {
        const ctx = extractLineContext(content, crashNode.line);
        line_context = { start: ctx.start, end: ctx.end };
      }

      return {
        file: node.file,
        content: finalContent,
        is_crash_site,
        line_context,
      };
    });

    const debugInput = {
      error_type,
      error_message,
      crash_location: crashNode,
      traversal_path: traversalPath,
      relevant_code: relevantCode,
      repo_context: {
        repo_name: `${owner}/${repo}`,
        entry_points: result_json.entryPoints || [],
        tech_stack: result_json.analysis?.tech_stack || [],
      },
    };

    const debugResult = await analyzeDebugWithGemini(debugInput);

    const confidence = calculateConfidence(traversalPath);
    const requires_runtime = requiresRuntimeCheck(error_type, error_message);

    const suspectedRootCause = traversalPath.find(n => n.relationship === "upstream")?.file;
    const highlightedMermaid = highlightDebugPath(
      mermaidDiagram,
      crashNode.file,
      traversalPath,
      suspectedRootCause
    );

    const { data: stored } = await supabase
      .from("debug_analyses")
      .insert({
        analysis_id: analysis.id,
        user_id: userId,
        stack_trace: stackTrace,
        error_type,
        error_message,
        crash_node: crashNode,
        traversal_path: traversalPath,
        root_cause_hypothesis: debugResult.root_cause_hypothesis,
        fix_suggestions: debugResult.fix_suggestions,
        verification_steps: debugResult.verification_steps,
        highlighted_mermaid: highlightedMermaid,
      })
      .select()
      .maybeSingle();

    const finalResult = {
      debug_id: stored?.id || "unknown",
      crash_node: crashNode,
      traversal_path: traversalPath,
      root_cause_hypothesis: debugResult.root_cause_hypothesis,
      fix_suggestions: debugResult.fix_suggestions,
      verification_steps: debugResult.verification_steps,
      confidence: confidence,
      requires_runtime_check: requires_runtime,
      highlighted_mermaid: highlightedMermaid,
    };

    await cacheDebug(repoUrl, traceHash, finalResult);

    return NextResponse.json(finalResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}