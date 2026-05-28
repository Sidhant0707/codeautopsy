// app/api/interview/route.ts
import { NextRequest, NextResponse } from "next/server";
import { INTERVIEW_SYSTEM_PROMPT } from "@/lib/interview/chat-logic";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
export const runtime = "edge";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function POST(req: NextRequest) {
  try {
    if (!GROQ_API_KEY) {
      return NextResponse.json(
        { error: "Missing Groq API Key" },
        { status: 500 },
      );
    }

    const { messages, codebaseContext } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Messages missing" }, { status: 400 });
    }

    // Build context string — truncated to keep token count manageable
    let contextText = "No codebase context provided.";
    if (codebaseContext) {
      contextText = JSON.stringify(codebaseContext).substring(0, 20000);
    }

    // Inject codebase context into the system prompt
    const systemPrompt = `${INTERVIEW_SYSTEM_PROMPT}

CODEBASE CONTEXT (JSON):
${contextText}`;

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        temperature: 0.3,
        // Kept intentionally short: interview questions should be focused
        max_tokens: 512,
        stream: true,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Groq API Error: ${errorText}`);
    }

    // Pass the SSE stream straight through to the client
    return new Response(res.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error("Interview API Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}