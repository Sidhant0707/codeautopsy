/**
 * app/api/analyze/route.ts
 *
 * Network layer only: Auth, Rate-limiting, DB cache, Streaming.
 * All heavy lifting is delegated to `runAstPipeline`.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { ratelimitAuth, ratelimitFree } from "@/lib/ratelimit";
import { checkUsageLimit } from "@/lib/usage";
import { processAndStoreCodebase } from "@/lib/rag";
import {
  runAstPipeline,
  PipelineError,
  type PipelineResult,
} from "@/lib/pipeline/ast-pipeline";
import { GitHubAuthError } from "@/lib/github";

const ANALYSIS_VERSION = 10;

// ── SafeStream ────────────────────────────────────────────────────────────────
/**
 * Guards the ReadableStreamDefaultController against two classes of bugs
 * that crash Vercel serverless functions in production:
 *
 * 1. `enqueue()` after `close()` — throws "Controller is already closed".
 * 2. `close()` called twice — same error.
 *
 * The `keepAlive` interval is always cleared through this class, making it
 * impossible to forget a clearInterval in any code path.
 */
class SafeStream {
  private closed = false;

  constructor(
    private readonly ctrl: ReadableStreamDefaultController,
    private readonly enc: TextEncoder,
    private readonly keepAlive: ReturnType<typeof setInterval>,
  ) {}

  /**
   * Serialises `payload` as JSON and enqueues it.
   * If the stream is already closed (or the client disconnected), the error is
   * absorbed and `close()` is called to clean up the interval immediately.
   */
  send(payload: object): void {
    if (this.closed) return;
    try {
      this.ctrl.enqueue(this.enc.encode(JSON.stringify(payload)));
    } catch {
      // Client disconnected or stream was cancelled — clean up now rather
      // than waiting for the next keep-alive tick.
      this.close();
    }
  }

  /**
   * Clears the keep-alive interval and closes the stream.
   * Safe to call multiple times.
   */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.keepAlive);
    try {
      this.ctrl.close();
    } catch {
      // Already closed or errored — nothing to do.
    }
  }

  /** Convenience: send an error envelope and close the stream. */
  sendError(error: string, extra?: Record<string, unknown>): void {
    this.send({ error, ...extra });
    this.close();
  }
}

// ── Route Handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // ── 1. Body parsing ────────────────────────────────────────────────────────
  // `req.json()` throws on malformed JSON or an empty body. Handle it before
  // opening the stream so we can return a clean 400 response.
  let body: { repoUrl?: unknown; isLocal?: unknown; localFiles?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid or missing JSON body." }, { status: 400 });
  }

  const isLocal    = body.isLocal === true;
  const repoUrl    = typeof body.repoUrl === "string" ? body.repoUrl.trim() : undefined;
  const localFiles = Array.isArray(body.localFiles) ? body.localFiles : undefined;

  // ── 2. Input validation ────────────────────────────────────────────────────
  // Validate before touching Supabase / Upstash to avoid wasting quota on
  // obviously bad requests.
  if (!isLocal && !repoUrl) {
    return NextResponse.json(
      { error: "repoUrl is required for non-local analysis." },
      { status: 400 },
    );
  }

  if (isLocal && !localFiles) {
    return NextResponse.json(
      { error: "localFiles is required for local analysis." },
      { status: 400 },
    );
  }

  // ── 3. Auth ────────────────────────────────────────────────────────────────
  const cookieStore = await cookies();
  const headerList  = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
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
        set(name: string, value: string, options: { path?: string; domain?: string; maxAge?: number; expires?: Date; httpOnly?: boolean; secure?: boolean; sameSite?: boolean | "lax" | "strict" | "none" }) {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Handle edge cases where cookies cannot be set
          }
        },
        remove(name: string, options: { path?: string; domain?: string; maxAge?: number; expires?: Date; httpOnly?: boolean; secure?: boolean; sameSite?: boolean | "lax" | "strict" | "none" }) {
          try {
            cookieStore.set(name, "", { ...options, maxAge: 0 });
          } catch {
            // Handle edge cases where cookies cannot be removed
          }
        },
      },
    }
  );

  let session  = null;
  let authUser = null;
  let isAuthor = false;

  try {
    const { data: { session: s } } = await supabase.auth.getSession();
    session = s;

    if (session) {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!userError && user) {
        authUser = user;
        isAuthor = user.email === process.env.AUTHOR_EMAIL;

        if (!isAuthor) {
          const isUnderLimit = await checkUsageLimit(supabase, user.id, user.email);
          if (!isUnderLimit) {
            return NextResponse.json(
              { error: "RATE_LIMIT_REACHED", message: "Daily limit reached." },
              { status: 429 },
            );
          }
        }
      }
    }
  } catch (err) {
    // Auth failure is non-fatal — demote to anonymous. The subsequent
    // rate-limit check will use the IP instead.
    console.error("[analyze] Auth setup error:", err);
  }

  const userId = authUser?.id;

  // ── 4. Rate limiting ───────────────────────────────────────────────────────
  if (!isAuthor) {
    const identifier = userId ?? ip;
    const limiter    = userId ? ratelimitAuth : ratelimitFree;
    const { success, limit, reset, remaining } = await limiter.limit(identifier);

    if (!success) {
      return NextResponse.json(
        { error: "RATE_LIMIT_REACHED", message: "Limit reached.", limit, remaining, reset },
        { status: 429 },
      );
    }
  }

  // ── 5. GitHub token resolution ─────────────────────────────────────────────
  const provider = authUser?.app_metadata?.provider;
  const githubToken: string | undefined =
    provider === "github" && session?.provider_token
      ? session.provider_token
      : process.env.GITHUB_FALLBACK_TOKEN;

  if (!githubToken) {
    return NextResponse.json({ error: "Missing GitHub token." }, { status: 500 });
  }

  // ── 6. Streaming response ──────────────────────────────────────────────────
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(ctrl) {
      // The keep-alive ping enqueues raw whitespace directly on `ctrl`.
      // This is intentional: SafeStream JSON-encodes its payloads, which
      // would produce `{}` and could confuse single-value JSON parsers.
      // If enqueue fails (stream closed/cancelled), the interval clears itself.
      const keepAlive = setInterval(() => {
        try {
          ctrl.enqueue(encoder.encode(" "));
        } catch {
          clearInterval(keepAlive);
        }
      }, 2_000);

      // All further writes/closes go through SafeStream to prevent
      // enqueue-after-close exceptions from crashing the function.
      const safe = new SafeStream(ctrl, encoder, keepAlive);

      try {
        const result: PipelineResult = await runAstPipeline({
          repoUrl:    repoUrl ?? "",
          githubToken,
          isLocal,
          localFiles,
          // Don't register a cache checker for local uploads — there's nothing
          // to cache against (no stable commitSha).
          checkCache: isLocal
            ? undefined
            : async (commitSha) => {
                const { data: cached, error: cacheError } = await supabase
                  .from("analyses")
                  .select("result_json")
                  .eq("repo_url", repoUrl)
                  .eq("commit_sha", commitSha)
                  .eq("analysis_version", ANALYSIS_VERSION)
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();

                if (cacheError) {
                  // Supabase returns soft errors — log and treat as miss
                  console.warn("[analyze] Cache query error:", cacheError.message);
                  return null;
                }

                return cached?.result_json ?? null;
              },
        });

        // Persist fresh analyses only — cached results are already in the DB.
        if (!isLocal && !result.cached) {
          // DB insert is non-fatal. A failure here must NOT prevent the
          // freshly-computed result from reaching the client.
          try {
            const { error: insertError } = await supabase.from("analyses").insert({
              repo_url:         repoUrl,
              repo_name:        `${result.owner}/${result.repo}`.toLowerCase(),
              commit_sha:       result.branch,
              analysis_version: ANALYSIS_VERSION,
              result_json:      result,
              user_id:          userId,
            });
            if (insertError) {
              console.error("[analyze] DB insert error:", insertError.message);
            }
          } catch (err) {
            console.error("[analyze] DB insert threw:", err);
          }

          // RAG indexing is also non-fatal — a failure should never block
          // the response. `fileContents` is always an array from the pipeline,
          // but guard anyway for safety.
          try {
            await processAndStoreCodebase(
              supabase,
              repoUrl!,
              result.fileContents ?? [],
            );
          } catch (err) {
            console.error("[analyze] RAG storage failed:", err);
          }
        }

        safe.send(result);
        safe.close();

      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";

        if (err instanceof GitHubAuthError || message === "REQUIRE_GITHUB_AUTH") {
          safe.sendError("REQUIRE_GITHUB_AUTH", { message: "GitHub auth required." });
        } else if (err instanceof PipelineError) {
          // Typed pipeline errors include a machine-readable code so the
          // client can render specific UI (e.g., "Too many files" banner).
          safe.sendError(message, { code: err.code });
        } else {
          safe.sendError(message);
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "application/json",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
    },
  });
}