import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { checkUsageLimit } from "@/lib/usage";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function fetchWithRetry(url: string, options: RequestInit, retries = 1): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    
    if (!res.ok && res.status >= 500 && retries > 0) {
      return fetchWithRetry(url, options, retries - 1);
    }
    
    return res;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw err;
    }

    if (retries > 0) {
      return fetchWithRetry(url, options, retries - 1);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!GROQ_API_KEY || !GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Server Configuration Error: Missing API Key" }, 
        { status: 500 }
      );
    }

    const { messages, repoUrl, repoContext } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Context or messages missing" }, { status: 400 });
    }

    const latestMessage = messages[messages.length - 1]?.content;
    const targetRepoUrl = repoUrl || (typeof repoContext === 'object' ? repoContext.url || repoContext.repo : null);

    if (!latestMessage || !targetRepoUrl) {
       return NextResponse.json({ error: "Missing query or repo URL" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(name: string) { return cookieStore.get(name)?.value; } } }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const isUnderLimit = await checkUsageLimit(supabase, user.id, user.email);
      if (!isUnderLimit) {
        return NextResponse.json(
          { error: "Daily limit reached. Upgrade to Architect." },
          { status: 429 }
        );
      }
    }

    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1/models/embedding-001:embedContent?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "models/embedding-001",
        content: { parts: [{ text: latestMessage }] }
      })
    });

    if (!geminiRes.ok) throw new Error("Failed to embed query");
    const geminiData = await geminiRes.json();
    const queryEmbedding = geminiData.embedding.values;

    const { data: matchedChunks, error: matchError } = await supabase.rpc('match_codebase_embeddings', {
      query_embedding: queryEmbedding,
      match_threshold: 0.3,
      match_count: 5,
      repo_url_filter: targetRepoUrl
    });

    if (matchError) throw matchError;

    let contextText = "No specific code snippets found for this query.";
    if (matchedChunks && matchedChunks.length > 0) {
      contextText =
        "Relevant code snippets:\n\n" +
        matchedChunks
          .map((c: { file_path: string; content: string }) => `--- File: ${c.file_path} ---\n${c.content}\n`)
          .join("\n\n");
    }

    const systemPrompt = `
You are a Senior Systems Architect.

Analyze ONLY the given repository context.
If missing or unclear -> say "Insufficient data in context".
NEVER guess or assume this is a web project unless proven.

CONTEXT:
${contextText}
`;

    const res = await fetchWithRetry(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        temperature: 0.1,
        max_tokens: 1024,
        stream: true,
      }),
    }, 1);

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Groq API Error (${res.status}): ${errorText.substring(0, 200)}`);
    }

    return new Response(res.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (err: unknown) {
    let errorMessage = "Analysis Failed";
    if (err instanceof Error) {
      errorMessage = err.name === "AbortError" 
        ? "Uplink Timeout: Analysis took too long or network dropped." 
        : err.message;
    }
    console.error("API Route Error:", errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}