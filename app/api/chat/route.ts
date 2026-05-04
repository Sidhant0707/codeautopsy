import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { checkUsageLimit } from "@/lib/usage";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "edge";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function POST(req: NextRequest) {
  try {
    if (!GROQ_API_KEY) {
      return NextResponse.json({ error: "Missing Groq API Key" }, { status: 500 });
    }

    const { messages, repoContext } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages missing" }, { status: 400 });
    }

    // 1. Anti-Bankruptcy Check (Kept this safe!)
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
        return NextResponse.json({ error: "Daily limit reached." }, { status: 429 });
      }
    }

    // 2. Pre-RAG Logic: Just grab the frontend context directly
    let contextText = "No repository context provided.";
    if (repoContext) {
      // Stringify the context the frontend already has, capping it so Groq doesn't crash
      contextText = JSON.stringify(repoContext).substring(0, 20000); 
    }

    const systemPrompt = `You are a Senior Systems Architect analyzing a codebase.
Use the provided JSON context about the repository to answer the user's questions. 

REPOSITORY CONTEXT (JSON):
${contextText}`;

    // 3. Direct Groq Streaming
    const res = await fetch(GROQ_URL, {
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
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Groq API Error: ${errorText}`);
    }

    return new Response(res.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error("Chat API Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}