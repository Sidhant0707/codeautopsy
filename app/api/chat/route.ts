import { NextRequest, NextResponse } from "next/server";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log("Chat request received, question:", body.question);
    console.log("Context keys:", Object.keys(body.repoContext || {}));

    const { question, repoContext } = body;

    if (!question || !repoContext) {
      return NextResponse.json({ error: "Missing question or context" }, { status: 400 });
    }

    const prompt = `
You are an expert code assistant analyzing a specific GitHub repository.

Here is everything known about this repository:

Repository: ${repoContext.owner}/${repoContext.repo}
Description: ${repoContext.description}
Architecture: ${repoContext.analysis.architecture_pattern}
Primary Language: ${repoContext.language}
Entry Points: ${repoContext.entryPoints.join(", ")}

What it does:
${repoContext.analysis.what_it_does}

Execution Flow:
${repoContext.analysis.execution_flow.map((s: string, i: number) => `${i + 1}. ${s}`).join("\n")}

Tech Stack:
${repoContext.analysis.tech_stack.map((t: { name: string; purpose: string }) => `- ${t.name}: ${t.purpose}`).join("\n")}

Key Modules:
${repoContext.analysis.key_modules.map((m: { file: string; role: string; why_it_exists: string }) => `- ${m.file} (${m.role}): ${m.why_it_exists}`).join("\n")}

Now answer this question about the repository:
${question}

Rules:
- Only answer based on the repository information provided above
- Be specific and reference actual files and modules when relevant
- If the answer is not in the provided context, say so honestly
- Keep answers concise but complete
- Do not make up file names or functionality that wasn't mentioned
`;

    console.log("Prompt length:", prompt.length);
    console.log("Sending to Gemini...");

    let res: Response | undefined;

    for (let attempt = 1; attempt <= 3; attempt++) {
      console.log(`Attempt ${attempt}...`);

      res = await fetch(GEMINI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3 },
        }),
      });

      console.log("Gemini response status:", res.status);

      if (res.ok) break;

      if ((res.status === 503 || res.status === 429) && attempt < 3) {
        console.log(`Rate limited, waiting ${3000 * attempt}ms...`);
        await new Promise((r) => setTimeout(r, 3000 * attempt));
        continue;
      }

      const errText = await res.text();
      console.error("Gemini error body:", errText);
      throw new Error(`Gemini API error: ${res.status}`);
    }

    if (!res || !res.ok) throw new Error("Gemini API failed after retries");

    const data = await res.json();
    const answer = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!answer) throw new Error("Empty response from Gemini");

    return NextResponse.json({ answer });

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Chat route error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}