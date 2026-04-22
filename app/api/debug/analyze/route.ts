// app/api/debug/analyze/route.ts

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

    // 1. SECURITY FIX: Use getUser() instead of getSession()
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id;
    const providerToken = undefined; // Note: getUser doesn't return provider_token directly. If you need it, you might have to fetch the session specifically for the token, but let's stick to getUser for auth.

    // 2. DEBUG LOG: Let's see exactly what the frontend is sending
    const body = await req.json();
    console.log("🚀 Code Doctor Received Payload:", body);

    const { repoUrl, stackTrace } = body;

    // 3. STRICTER VALIDATION: Catch empty strings
    if (!repoUrl || !stackTrace || stackTrace.trim() === "") {
      return NextResponse.json(
        { error: `Missing data. Received repoUrl: ${!!repoUrl}, stackTrace: ${!!stackTrace}` },
        { status: 400 }
      );
    }

    // Extract error info
    const { error_type, error_message } = extractErrorInfo(stackTrace);

    // Check cache
    const traceHash = hashStackTrace(stackTrace);
    const cacheKey = `${repoUrl}:${traceHash}`;
    const cached = await getCachedDebug(repoUrl, traceHash);
    
    if (cached) {
      return NextResponse.json({ ...cached, cached: true });
    }

    // Fetch existing analysis from database
    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid GitHub URL" }, { status: 400 });
    }

    const { owner, repo } = parsed;

    const { data: analysis, error: dbError } = await supabase
      .from("analyses")
      .select("*")
      .eq("repo_url", repoUrl)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dbError) {
      console.error("Database error:", dbError);
      return NextResponse.json(
        { error: "Failed to fetch analysis from database" },
        { status: 500 }
      );
    }

    const { result_json } = analysis;
    const { dependencyGraph, fanIn, mermaidDiagram } = result_json;

    // Get all files from the dependency graph
    const allFiles = Object.keys(dependencyGraph);

    // Parse stack trace
    const crashNode = parseStackTrace(stackTrace, allFiles);

    if (!crashNode) {
      return NextResponse.json(
        { error: "Could not extract crash location from stack trace. Make sure the file exists in the analyzed repository." },
        { status: 400 }
      );
    }

    // Traverse graph
    let traversalPath = traverseFromCrash(
      crashNode.file,
      dependencyGraph,
      fanIn
    );

    // Apply heuristics
    traversalPath = applyDebugHeuristics(traversalPath, crashNode, error_type);

    // Fetch missing files
    const fileContents = result_json.fileContents || [];
    const existingContents = new Map<string, string>(
      fileContents.map((f: any) => [f.path as string, f.content as string])
    );

    const allContents = await fetchMissingFiles(
      traversalPath,
      existingContents,
      owner,
      repo,
      providerToken
    );

    // Build debug context
    const relevantCode = traversalPath.slice(0, 10).map((node) => {
      const content = allContents.get(node.file) || "// Content not available";
      const is_crash_site = node.file === crashNode.file;

      // If crash site, extract line context
      let line_context = undefined;
      if (is_crash_site) {
        const ctx = extractLineContext(content, crashNode.line);
        line_context = { start: ctx.start, end: ctx.end };
      }

      return {
        file: node.file,
        content: is_crash_site 
          ? extractLineContext(content, crashNode.line).snippet 
          : content,
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

    // Call Gemini
    const debugResult = await analyzeDebugWithGemini(debugInput);

    // Calculate confidence
    const confidence = calculateConfidence(traversalPath, crashNode);
    const requires_runtime = requiresRuntimeCheck(error_type, error_message);

    // Highlight Mermaid (use first upstream node as suspected root cause)
    const suspectedRootCause = traversalPath.find(n => n.relationship === "upstream")?.file;
    const highlightedMermaid = highlightDebugPath(
      mermaidDiagram,
      crashNode.file,
      traversalPath,
      suspectedRootCause
    );

    // Store result in database
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

    // Cache result
    await cacheDebug(repoUrl, traceHash, finalResult);

    return NextResponse.json(finalResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Debug analysis error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}