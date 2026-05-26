export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { validateApiKey } from "@/lib/api-keys";
import { ratelimitApiKey } from "@/lib/ratelimit";
import { parseRepoUrl, GitHubAuthError } from "@/lib/github";
import { runAstPipeline, PipelineError } from "@/lib/pipeline/ast-pipeline";

const ANALYSIS_VERSION = 10;

const PIPELINE_ERROR_STATUS: Record<string, number> = {
  INVALID_REPO_URL:  400,
  TOO_MANY_FILES:    422,
  PAYLOAD_TOO_LARGE: 422,
  NO_FILES_FOUND:    422,
  FETCH_TIMEOUT:     504,
};

// ─── helpers ────────────────────────────────────────────────────────────────

type RL = { limit: number; remaining: number; reset: number };

/** Build a JSON response and stamp it with rate-limit headers in one call. */
function rlJson(body: object, status: number, rl: RL): NextResponse {
  const res = NextResponse.json(body, { status });
  res.headers.set("X-RateLimit-Limit",     String(rl.limit));
  res.headers.set("X-RateLimit-Remaining", String(rl.remaining));
  res.headers.set("X-RateLimit-Reset",     String(rl.reset));
  return res;
}

async function makeSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: cookieStore as unknown as Parameters<typeof createServerClient>[2]["cookies"] },
  );
}

// ─── handler ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {

  // Auth ── collapse the two-step check into one expression
  const apiKey = req.headers.get("Authorization")?.match(/^Bearer\s+(\S+)/)?.[1];
  if (!apiKey) {
    return NextResponse.json(
      { error: "Missing or invalid Authorization header. Expected: Bearer <api_key>" },
      { status: 401 },
    );
  }

  let keyRecord: Awaited<ReturnType<typeof validateApiKey>>;
  try {
    keyRecord = await validateApiKey(apiKey);
  } catch (err) {
    console.error("\n[FATAL ERROR] API Key Validation Crashed:", err, "\n");
    return NextResponse.json(
      { error: "Key validation service unavailable. Please retry." },
      { status: 503 },
    );
  }
  if (!keyRecord) {
    return NextResponse.json({ error: "Invalid or revoked API key." }, { status: 403 });
  }

  // Rate limit ── .catch() replaces the verbose try/catch + fallback object
  const rl = await ratelimitApiKey.limit(keyRecord.id)
    .catch(() => ({ success: true, limit: 0, remaining: 0, reset: 0 }));

  if (!rl.success) {
    return rlJson(
      {
        error:      "Rate limit exceeded.",
        message:    `Quota resets at ${new Date(rl.reset).toISOString()}`,
        retryAfter: Math.ceil((rl.reset - Date.now()) / 1000),
      },
      429,
      rl,
    );
  }

  // Body validation
  let body: { repoUrl?: unknown } | null;
  try {
    body = await req.json();
  } catch {
    return rlJson({ error: "Invalid or missing JSON body." }, 400, rl);
  }

  const repoUrl = typeof body?.repoUrl === "string" ? body.repoUrl.trim() : "";
  if (!repoUrl) {
    return rlJson({ error: "repoUrl is required." }, 400, rl);
  }
  if (!parseRepoUrl(repoUrl)) {
    return rlJson(
      { error: "Invalid GitHub URL.", message: "Expected format: https://github.com/owner/repo" },
      400,
      rl,
    );
  }

  // Env guard — checked once, early, before any I/O
  const githubToken = process.env.GITHUB_FALLBACK_TOKEN;
  if (!githubToken) {
    return NextResponse.json(
      { error: "Server misconfiguration. Please contact support." },
      { status: 500 },
    );
  }

  // Pipeline
  try {
    // Supabase client is created lazily — only when we're sure we'll need it
    const supabase = await makeSupabase();

    const result = await runAstPipeline({
      repoUrl,
      githubToken,
      isLocal: false,
      checkCache: async (commitSha) => {
        const { data, error } = await supabase
          .from("analyses")
          .select("result_json")
          .eq("repo_url",          repoUrl)
          .eq("commit_sha",        commitSha)
          .eq("analysis_version",  ANALYSIS_VERSION)
          .order("created_at",     { ascending: false })
          .limit(1)
          .maybeSingle();

        return error ? null : (data?.result_json ?? null);
      },
    });

    // Fire-and-forget cache write; log failures instead of swallowing them
    if (!result.cached) {
      supabase.from("analyses").insert({
        repo_url:         repoUrl,
        repo_name:        `${result.owner}/${result.repo}`.toLowerCase(),
        commit_sha:       result.branch,
        analysis_version: ANALYSIS_VERSION,
        result_json:      result,
        user_id:          null,
      }).then(({ error }) => {
        if (error) console.error("[analyses] cache insert failed:", error);
      });
    }

    return rlJson(
      {
        meta: {
          repo:       repoUrl,
          owner:      result.owner,
          name:       result.repo,
          branch:     result.branch,
          stars:      result.stars,
          language:   result.language,
          analyzedAt: new Date().toISOString(),
          cached:     result.cached ?? false,
          nodeCount:  Object.keys(result.dependencyGraph).length,
          edgeCount:  Object.values(result.dependencyGraph).flat().length,
        },
        graph: {
          dependencyGraph:    result.dependencyGraph,
          fanIn:              result.fanIn,
          entryPoints:        result.entryPoints,
          healthMetrics:      result.healthMetrics,
          topFiles:           result.topFilesForGroq,
          blastRadiusTargets: result.blastRadiusTargets,
          coverageGaps:       result.coverageGaps,
        },
      },
      200,
      rl,
    );

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Pipeline failed.";

    if (err instanceof GitHubAuthError || message === "REQUIRE_GITHUB_AUTH") {
      return rlJson(
        {
          error:   "PRIVATE_REPO",
          message: "This repository is private. The headless API only supports public repos.",
        },
        422,
        rl,
      );
    }

    if (err instanceof PipelineError) {
      return rlJson(
        { error: err.code, message },
        PIPELINE_ERROR_STATUS[err.code] ?? 500,
        rl,
      );
    }

    return rlJson({ error: "INTERNAL_ERROR", message }, 500, rl);
  }
}