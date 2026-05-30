/**
 * app/api/analyze/route.ts
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { ratelimitAuth, ratelimitFree, ratelimitPro } from "@/lib/ratelimit";
import { cookies, headers } from "next/headers";
import { createServerClient } from "@supabase/ssr";
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
class SafeStream {
  private closed = false;

  constructor(
    private readonly ctrl: ReadableStreamDefaultController,
    private readonly enc: TextEncoder,
    private readonly keepAlive: ReturnType<typeof setInterval>,
  ) {}

  send(payload: object): void {
    if (this.closed) return;
    try {
      this.ctrl.enqueue(this.enc.encode(JSON.stringify(payload)));
    } catch {
      this.close();
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.keepAlive);
    try {
      this.ctrl.close();
    } catch {
    }
  }

  sendError(error: string, extra?: Record<string, unknown>): void {
    this.send({ error, ...extra });
    this.close();
  }
}

// ── Route Handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // ── 1. Body parsing ────────────────────────────────────────────────────────
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
  let isPro    = false;

  try {
    const { data: { session: s } } = await supabase.auth.getSession();
    session = s;

    if (session) {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!userError && user) {
        authUser = user;
        isAuthor = user.email === process.env.AUTHOR_EMAIL;

        if (!isAuthor) {
          // Check pro status
          const { data: profile } = await supabase
            .from("profiles")
            .select("plan_tier")
            .eq("id", user.id)
            .single();

          isPro = profile?.plan_tier === "pro";

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
    console.error("[analyze] Auth setup error:", err);
  }

  const userId = authUser?.id;

  // ── 4. Rate limiting ───────────────────────────────────────────────────────
  if (!isAuthor) {
    const identifier = userId ?? ip;

    // Pro users get a higher Upstash bucket, anon users get IP-based free bucket
    const limiter = !userId
      ? ratelimitFree
      : isPro
      ? ratelimitPro
      : ratelimitAuth;

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
      const keepAlive = setInterval(() => {
        try {
          ctrl.enqueue(encoder.encode(" "));
        } catch {
          clearInterval(keepAlive);
        }
      }, 2_000);

      const safe = new SafeStream(ctrl, encoder, keepAlive);

      try {
        const result: PipelineResult = await runAstPipeline({
          repoUrl:    repoUrl ?? "",
          githubToken,
          isLocal,
          localFiles,
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
                  console.warn("[analyze] Cache query error:", cacheError.message);
                  return null;
                }

                return cached?.result_json ?? null;
              },
        });

        if (!isLocal && !result.cached) {
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