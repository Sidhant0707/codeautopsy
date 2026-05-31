import { streamAnalyzeWithGemini } from "@/lib/gemini";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { checkAiUsageLimit, insertAiUsage } from "@/lib/ai-usage";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────────
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options),
              );
            } catch {}
          },
        },
      },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // ── 2. Gate: not logged in ────────────────────────────────────────────────
    if (!user) {
      return NextResponse.json(
        { error: "AI_AUTH_REQUIRED" },
        { status: 401 },
      );
    }

    // ── 3. Gate: usage limit ──────────────────────────────────────────────────
    const { allowed, used, limit } = await checkAiUsageLimit(
      supabase,
      user.id,
      user.email,
    );

    if (!allowed) {
      return NextResponse.json(
        { error: "AI_LIMIT_REACHED", used, limit },
        { status: 402 },
      );
    }

    // ── 4. Parse body ─────────────────────────────────────────────────────────
    const body = await req.json();
    const {
      repoUrl,       // ← used for cache lookup
      repoName,
      description,
      entryPoints,
      topFiles,
      fileContents,
      blastRadiusTargets,
      healthMetrics,
    } = body;

    // ── 5. Cache check — skip Groq entirely if AI was already run for this repo
    if (repoUrl) {
      const { data: cached } = await supabase
        .from("analyses")
        .select("ai_response")
        .eq("repo_url", repoUrl)
        .eq("user_id", user.id)
        .not("ai_response", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cached?.ai_response) {
        console.log("[ai] Cache hit — returning stored response, 0 tokens spent");
        const encoder = new TextEncoder();
        const cachedStream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                typeof cached.ai_response === "string"
                  ? cached.ai_response
                  : JSON.stringify(cached.ai_response),
              ),
            );
            controller.close();
          },
        });

        return new Response(cachedStream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        });
      }
    }

    // ── 6. Stream AI response ─────────────────────────────────────────────────
    const responseStream = await streamAnalyzeWithGemini(
      repoName,
      description,
      entryPoints,
      topFiles,
      fileContents,
      blastRadiusTargets,
      healthMetrics,
    );

    // ── 7. Tee the stream: client gets it live, we accumulate to cache ────────
    const [clientStream, storeStream] = responseStream.body!.tee();

    // Background: accumulate full response and store in analyses row
    if (repoUrl) {
      (async () => {
        const reader = storeStream.getReader();
        const decoder = new TextDecoder();
        const chunks: string[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(decoder.decode(value, { stream: true }));
        }

        const fullResponse = chunks.join("");

        try {
          const { error } = await supabase
            .from("analyses")
            .update({ ai_response: fullResponse })
            .eq("repo_url", repoUrl)
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(1);

          if (error) console.error("[ai] Cache store failed:", error.message);
          else console.log("[ai] AI response cached for future calls");
        } catch (err) {
          console.error("[ai] Cache store threw:", err);
        }
      })();
    } else {
      // No repoUrl — drain the tee'd branch so it doesn't block
      storeStream.cancel();
    }

    // ── 8. Record usage after stream is kicked off ────────────────────────────
    // Non-blocking — do not await, never fail the response
    insertAiUsage(supabase, user.id, repoName ?? "unknown").catch((err) =>
      console.error("[ai] Usage insert failed:", err),
    );

    return new Response(clientStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error) {
    console.error("AI Streaming Error:", error);
    return NextResponse.json(
      { error: "Failed to generate AI analysis stream" },
      { status: 500 },
    );
  }
}