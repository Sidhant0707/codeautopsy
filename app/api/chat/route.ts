import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

function safeTruncate(text: string, limit: number) {
  if (text.length <= limit) return text;

  let truncated = text.slice(0, limit);
  truncated = truncated.replace(/<[^>]*$/, "");
  truncated = truncated.replace(/&[^;\s]*$/, "");

  return truncated + "\n\n...[CONTEXT TRUNCATED SAFELY]...";
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 1): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  try {
    const { signal, ...restOptions } = options;
    const res = await fetch(url, { ...restOptions, signal: controller.signal });
    
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
  let repoContextName = "unknown";

  try {
    if (!GROQ_API_KEY) {
      return NextResponse.json(
        { error: "Server Configuration Error: Missing API Key" }, 
        { status: 500 }
      );
    }

    const { question, repoContext } = await req.json();

    if (!question || !repoContext) {
      return NextResponse.json({ error: "Context Missing" }, { status: 400 });
    }

    if (typeof repoContext === "object" && repoContext?.repo) {
      repoContextName = repoContext.repo;
    }

    let rawContext: string;

    if (typeof repoContext === "string") {
      rawContext = repoContext;
    } else {
      rawContext = [
        `Language: ${repoContext.language ?? "unknown"}`,
        `Architecture: ${repoContext.analysis?.architecture_pattern ?? "unknown"}`,
        `Files:\n(Top-level structure)\n${(repoContext.fileContents ?? [])
          .slice(0, 40)
          .map((f: { path: string }) => `- ${f.path}`)
          .join("\n")}`,
        `Modules:\n(Key functional units)\n${(repoContext.analysis?.key_modules ?? [])
          .slice(0, 20)
          .map((m: { file: string; role: string }) => `- ${m.file}: ${m.role}`)
          .join("\n")}`,
      ].join("\n\n");
    }

    if (rawContext.length > 100000) {
      return NextResponse.json(
        { error: "Payload Too Large: Context exceeds maximum allowed size." },
        { status: 413 }
      );
    }

    const safeContext = safeTruncate(rawContext, 20000);

    const systemPrompt = `
You are a Senior Systems Architect.

Analyze ONLY the given repository context.
If missing or unclear → say "Insufficient data in context".
NEVER guess or assume this is a web project unless proven.

Focus on:
- Architecture pattern
- Key modules and roles
- Data/Execution flow

Context:
${safeContext}
`;

    const res = await fetchWithRetry(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ],
        temperature: 0.1,
        max_tokens: 1024,
      }),
    }, 1);

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Groq API Error (${res.status}): ${errorText.substring(0, 200)}`);
    }

    const data = await res.json();

    if (!data?.choices?.length || !data.choices[0]?.message?.content) {
      throw new Error("Invalid or empty response structure from LLM");
    }

    let answer = data.choices[0].message.content?.trim();

    if (!answer || answer.length < 10) {
      answer = "Insufficient data in context to generate a meaningful analysis.";
    } else {
      answer = answer
        .replace(/={3,}/g, "")
        .replace(/-{3,}/g, "")
        .replace(/^(?!\s*#)\*\*(.*?)\*\*\s*$/gm, "### $1")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
    }

    return NextResponse.json({ answer });

  } catch (err: unknown) {
    let errorMessage = "Analysis Failed";
    
    if (err instanceof Error) {
      errorMessage = err.name === "AbortError" 
        ? "Uplink Timeout: Analysis took too long or network dropped." 
        : err.message;
    }
    
    console.error("API Route Error:", {
      message: errorMessage,
      repo: repoContextName,
    });
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}