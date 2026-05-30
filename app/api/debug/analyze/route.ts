// app/api/debug/analyze/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { parseStackTrace, extractErrorInfo } from "@/lib/debug/stack-parser";
import { traverseFromCrash } from "@/lib/debug/graph-traversal";
import { analyzeDebugWithGemini } from "@/lib/debug/groq-debug";
import { highlightDebugPath } from "@/lib/debug/mermaid-highlighter";
import { fetchMissingFiles, extractLineContext } from "@/lib/debug/file-fetcher";
import { getCachedDebug, cacheDebug, hashStackTrace } from "@/lib/debug/cache";
import { applyDebugHeuristics, calculateConfidence, requiresRuntimeCheck } from "@/lib/debug/heuristics";
import { parseRepoUrl } from "@/lib/github";

// ─── Constants ───────────────────────────────────────────────────────────────

const DAILY_LIMIT = 3;
const MAX_TRAVERSAL_NODES: Record<string, number> = {
  TypeError: 5,
  ReferenceError: 5,
  SyntaxError: 3,
  RangeError: 4,
  default: 10,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMaxNodes(errorType: string): number {
  return MAX_TRAVERSAL_NODES[errorType] ?? MAX_TRAVERSAL_NODES.default;
}

function stripComments(content: string): string {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !line.startsWith("//") &&
        !line.startsWith("/*") &&
        !line.startsWith("*")
    )
    .join("\n");
}

// ─── Route Handler ───────────────────────────────────────────────────────────

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

    // ── 1. Auth ───────────────────────────────────────────────────────────────
    let userId: string | undefined;
    let providerToken: string | undefined;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userId = user?.id;

      const {
        data: { session },
      } = await supabase.auth.getSession();
      providerToken = session?.provider_token ?? undefined;

      if (!providerToken) {
        console.warn(
          "[debug/analyze] No provider token — GitHub file fetching will use unauthenticated API (60 req/hr limit)."
        );
      }
    } catch (authErr) {
      console.warn(
        "[debug/analyze] Auth fetch failed, continuing as guest:",
        authErr
      );
    }

    // ── 2. Input validation ───────────────────────────────────────────────────
    const body = await req.json();
    const { repoUrl, stackTrace } = body;

    if (!repoUrl || !stackTrace || stackTrace.trim() === "") {
      return NextResponse.json(
        {
          error: `Missing data. Received repoUrl: ${!!repoUrl}, stackTrace: ${!!stackTrace}`,
        },
        { status: 400 }
      );
    }

    // ── 3. Validate repo URL before any DB/cache hits ─────────────────────────
    const parsed = parseRepoUrl(repoUrl);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid GitHub URL" },
        { status: 400 }
      );
    }

    const { owner, repo } = parsed;

    // ── 4. Rate limiting ──────────────────────────────────────────────────────
    if (userId) {
      const today = new Date().toISOString().split("T")[0];

      const { count, error: countError } = await supabase
        .from("debug_analyses")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", `${today}T00:00:00.000Z`);

      if (countError) {
        console.error("[debug/analyze] Rate limit check failed:", countError);
      } else if ((count ?? 0) >= DAILY_LIMIT) {
        return NextResponse.json(
          { error: `Daily limit of ${DAILY_LIMIT} diagnoses reached. Try again tomorrow.` },
          { status: 429 }
        );
      }
    }

    // ── 5. Extract error info ─────────────────────────────────────────────────
    const { error_type, error_message } = extractErrorInfo(stackTrace);

    // ── 6. Cache check ────────────────────────────────────────────────────────
    const traceHash = hashStackTrace(stackTrace);
    const cached = await getCachedDebug(repoUrl, traceHash);

    if (cached) {
      return NextResponse.json({ ...cached, cached: true });
    }

    // ── 7. Fetch latest analysis from DB (dynamic version) ────────────────────
    const { data: analysis, error: dbError } = await supabase
      .from("analyses")
      .select("*")
      .eq("repo_url", repoUrl)
      .order("analysis_version", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (dbError) {
      console.error("[debug/analyze] DB fetch failed:", dbError);
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

    // ── 8. Parse stack trace ──────────────────────────────────────────────────
    const allFiles = Object.keys(dependencyGraph);
    const crashNode = parseStackTrace(stackTrace, allFiles);

    if (!crashNode) {
      return NextResponse.json(
        {
          error:
            "Could not extract crash location from stack trace. Make sure the file exists in the analyzed repository.",
        },
        { status: 400 }
      );
    }

    // ── 9. Graph traversal + heuristics ───────────────────────────────────────
    let traversalPath = traverseFromCrash(crashNode.file, dependencyGraph, fanIn);
    traversalPath = applyDebugHeuristics(traversalPath, error_type);

    // ── 10. Fetch file contents ───────────────────────────────────────────────
    const fileContents: { path: string; content: string }[] =
      result_json.fileContents || [];

    const existingContents = new Map<string, string>(
      fileContents.map((f) => [f.path, f.content])
    );

    const allContents = await fetchMissingFiles(
      traversalPath,
      existingContents,
      owner,
      repo,
      providerToken
    );

    // ── 11. Build relevant code snapshot ─────────────────────────────────────
    const maxNodes = getMaxNodes(error_type);

    const relevantCode = traversalPath.slice(0, maxNodes).map((node) => {
      const content = allContents.get(node.file) || "";
      const isCrashSite = node.file === crashNode.file;

      const finalContent = isCrashSite
        ? extractLineContext(content, crashNode.line).snippet
        : stripComments(content).split("\n").slice(0, 300).join("\n");

      const lineContext = isCrashSite
        ? (() => {
            const ctx = extractLineContext(content, crashNode.line);
            return { start: ctx.start, end: ctx.end };
          })()
        : undefined;

      return {
        file: node.file,
        content: finalContent,
        is_crash_site: isCrashSite,
        line_context: lineContext,
      };
    });

    // ── 12. AI analysis ───────────────────────────────────────────────────────
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

    // ── 13. Post-processing ───────────────────────────────────────────────────
    const confidence = calculateConfidence(traversalPath);
    const requires_runtime = requiresRuntimeCheck(error_type, error_message);

    const suspectedRootCause = traversalPath.find(
      (n) => n.relationship === "upstream"
    )?.file;

    const highlightedMermaid = highlightDebugPath(
      mermaidDiagram,
      crashNode.file,
      traversalPath,
      suspectedRootCause
    );

    // ── 14. Persist to DB ─────────────────────────────────────────────────────
    const { data: stored, error: insertError } = await supabase
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

    if (insertError) {
      console.error("[debug/analyze] Failed to store debug result:", insertError);
    }

    // ── 15. Cache + respond ───────────────────────────────────────────────────
    const finalResult = {
      debug_id: stored?.id || "unknown",
      crash_node: crashNode,
      traversal_path: traversalPath,
      root_cause_hypothesis: debugResult.root_cause_hypothesis,
      fix_suggestions: debugResult.fix_suggestions,
      verification_steps: debugResult.verification_steps,
      confidence,
      requires_runtime_check: requires_runtime,
      highlighted_mermaid: highlightedMermaid,
    };

    await cacheDebug(repoUrl, traceHash, finalResult);

    return NextResponse.json(finalResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[debug/analyze] Unhandled error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}