import { NextRequest, NextResponse } from "next/server";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { question, repoContext } = body;

    if (!question || !repoContext) {
      return NextResponse.json({ error: "Missing question or context" }, { status: 400 });
    }

    const systemPrompt = `You are an expert code assistant analyzing a specific GitHub repository.

Repository: ${repoContext.owner}/${repoContext.repo}
Description: ${repoContext.description}
Architecture: ${repoContext.analysis.architecture_pattern}
Primary Language: ${repoContext.language}
Entry Points: ${repoContext.entryPoints.join(", ")}

What it does: ${repoContext.analysis.what_it_does}

Execution Flow:
${repoContext.analysis.execution_flow.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}

Tech Stack:
${repoContext.analysis.tech_stack.map((t: { name: string; purpose: string }) => `- ${t.name}: ${t.purpose}`).join("\n")}

Key Modules:
${repoContext.analysis.key_modules.map((m: { file: string; role: string; why_it_exists: string }) => `- ${m.file} (${m.role}): ${m.why_it_exists}`).join("\n")}

Rules:
- Only answer based on the repository information provided
- Be specific and reference actual files when relevant
- If not in context, say so honestly
- Keep answers concise but complete`;

    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: question },
        ],
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Groq error:", errText);
      throw new Error(`Groq API error: ${res.status}`);
    }

    const data = await res.json();
    const answer = data.choices?.[0]?.message?.content;
    if (!answer) throw new Error("Empty response from Groq");

    return NextResponse.json({ answer });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Chat route error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}