import { DebugContext, DebugResult } from "./types";

export async function analyzeDebugWithGemini(
  input: DebugContext
): Promise<DebugResult> {
  // Ensure we are strictly using the new Groq pipeline
  if (process.env.USE_GROQ_FOR_ANALYSIS !== 'true') {
    throw new Error("Gemini is currently disabled. Please use Groq. Check Vercel Env Variables.");
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY environment variable");
  }

  const url = "https://api.groq.com/openai/v1/chat/completions";

  const codeSnippets = input.relevant_code
    .map((file) => {
      const marker = file.is_crash_site ? "🔴 CRASH SITE" : "";
      return `=== ${file.file} ${marker} ===\n${file.content}`;
    })
    .join("\n\n");

  const traversalSummary = input.traversal_path
    .slice(0, 10)
    .map(
      (n) =>
        `- ${n.file} (distance: ${n.distance}, fan-in: ${n.fan_in}, ${n.relationship})`
    )
    .join("\n");

  const systemPrompt = `You are a debugging assistant analyzing a crash in a codebase.

CRITICAL CONSTRAINTS:
- You ONLY have access to static code dependencies, NOT runtime state.
- If the error suggests missing data (undefined, null), your FIRST suggestion must involve checking:
  1. Database queries
  2. API responses
  3. Environment variables (.env)
  4. Authentication state

ERROR DETAILS:
Type: ${input.error_type}
Message: ${input.error_message}
Crash Location: ${input.crash_location.file}:${input.crash_location.line}
${input.crash_location.function ? `Function: ${input.crash_location.function}` : ""}

DEPENDENCY ANALYSIS:
Files analyzed (ordered by relevance):
${traversalSummary}

CODE SNIPPETS:
${codeSnippets}

REPOSITORY CONTEXT:
Name: ${input.repo_context.repo_name}
Entry Points: ${input.repo_context.entry_points.join(", ")}
Tech Stack: ${input.repo_context.tech_stack.map((t) => t.name).join(", ")}

TASK:
Analyze the crash and return ONLY a valid JSON object with this exact structure:
{
  "root_cause_hypothesis": "Your best guess at the root cause (2-3 sentences)",
  "fix_suggestions": ["concrete fix 1", "concrete fix 2", "concrete fix 3"],
  "verification_steps": ["step to verify fix 1", "step 2", "step 3"],
  "confidence": "high | medium | low",
  "requires_runtime_check": true | false
}`;

  let res: Response | undefined;

  for (let attempt = 1; attempt <= 3; attempt++) {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Analyze this crash and return only the JSON." },
        ],
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
    });

    if (res.ok) break;

    if ((res.status === 503 || res.status === 429) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 5000 * attempt));
      continue;
    }

    const error = await res.text();
    throw new Error(`Groq API error ${res.status}: ${error}`);
  }

  if (!res || !res.ok) throw new Error("Groq API failed after retries");

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty response from Groq");

  return JSON.parse(text) as DebugResult;
}