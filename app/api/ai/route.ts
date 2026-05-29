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
      repoName,
      description,
      entryPoints,
      topFiles,
      fileContents,
      blastRadiusTargets,
      healthMetrics,
    } = body;

    // ── 5. Stream AI response ─────────────────────────────────────────────────
    const responseStream = await streamAnalyzeWithGemini(
      repoName,
      description,
      entryPoints,
      topFiles,
      fileContents,
      blastRadiusTargets,
      healthMetrics,
    );

    // ── 6. Record usage after stream is kicked off ────────────────────────────
    // Non-blocking — do not await, never fail the response
    insertAiUsage(supabase, user.id, repoName ?? "unknown").catch((err) =>
      console.error("[ai] Usage insert failed:", err),
    );

    return responseStream;
  } catch (error) {
    console.error("AI Streaming Error:", error);
    return NextResponse.json(
      { error: "Failed to generate AI analysis stream" },
      { status: 500 },
    );
  }
}