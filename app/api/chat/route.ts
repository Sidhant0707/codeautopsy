import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { checkUsageLimit } from "@/lib/usage";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ── Groq config ───────────────────────────────────────────────────────────────
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL     = "https://api.groq.com/openai/v1/chat/completions";

// Free tier
const FREE_MODEL        = "llama-3.3-70b-versatile";
const FREE_CONTEXT_SIZE = 6_000;
const FREE_MAX_TOKENS   = 512;

// Pro tier  
const PRO_MODEL        = "openai/gpt-oss-120b";
const PRO_CONTEXT_SIZE = 20_000;
const PRO_MAX_TOKENS   = 2_048;

// ── Types ─────────────────────────────────────────────────────────────────────
interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface RequestBody {
  messages: ChatMessage[];
  repoContext?: unknown;
}

// ── Helper: build a typed error response ─────────────────────────────────────
function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // 1. Guard: API key must be present
  if (!GROQ_API_KEY) {
    console.error("GROQ_API_KEY is not set.");
    return errorResponse("Server misconfiguration: missing API key.", 500);
  }

  // 2. Parse + validate body
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Invalid JSON body.", 400);
  }

  const { messages, repoContext } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return errorResponse("'messages' must be a non-empty array.", 400);
  }

  // 3. Auth + plan check via Supabase
  let isPro = false;

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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      // Fetch plan tier
      const { data: profile } = await supabase
        .from("profiles")
        .select("plan_tier")
        .eq("id", user.id)
        .single();

      isPro = profile?.plan_tier === "pro";

      // Rate-limit free users only
      if (!isPro) {
        const isUnderLimit = await checkUsageLimit(supabase, user.id, user.email);
        if (!isUnderLimit) {
          return NextResponse.json(
            {
              error: "RATE_LIMIT_REACHED",
              message: "Daily free limit reached. Upgrade to Pro for unlimited access.",
            },
            { status: 429 }
          );
        }
      }
    }
  } catch (authErr) {
    // Non-fatal: unauthenticated users fall through as free-tier
    console.warn("Auth check failed, treating as free user:", authErr);
  }

  // 4. Select tier config
  const model       = isPro ? PRO_MODEL        : FREE_MODEL;
  const contextSize = isPro ? PRO_CONTEXT_SIZE : FREE_CONTEXT_SIZE;
  const maxTokens   = isPro ? PRO_MAX_TOKENS   : FREE_MAX_TOKENS;

  // 5. Build system prompt with truncated repo context
  const contextText = repoContext
    ? JSON.stringify(repoContext).slice(0, contextSize)
    : "No repository context provided.";

  const systemPrompt = `You are a Senior Systems Architect with deep expertise in software design, \
architecture patterns, and code analysis.

Analyze the repository context below to answer the user's questions accurately and concisely. \
When referencing files or modules, cite them by name. If the context is insufficient to answer \
definitively, say so clearly rather than guessing.

REPOSITORY CONTEXT (JSON):
${contextText}`;

  // 6. Call Groq with streaming
  let groqRes: Response;
  try {
    groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        temperature: 0.1,
        max_tokens: maxTokens,
        stream: true,
      }),
    });
  } catch (networkErr) {
    console.error("Network error reaching Groq:", networkErr);
    return errorResponse("Failed to reach Groq API. Please retry.", 502);
  }

  // 7. Surface Groq-level errors clearly
  if (!groqRes.ok) {
    const errText = await groqRes.text();
    console.error(`Groq ${groqRes.status} error:`, errText);

    // Parse Groq error for a cleaner client message
    let clientMessage = `Groq API Error (${groqRes.status})`;
    try {
      const parsed = JSON.parse(errText);
      if (parsed?.error?.message) clientMessage = parsed.error.message;
    } catch {
      
    }

    return errorResponse(clientMessage, groqRes.status >= 500 ? 502 : groqRes.status);
  }

  // 8. Stream the response body back to the client
  return new Response(groqRes.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",      
      Connection: "keep-alive",
    },
  });
}