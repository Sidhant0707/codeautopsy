// lib/debug/gemini-debug.ts

import { DebugContext, DebugResult } from "./types";

export async function analyzeDebugWithGemini(
  input: DebugContext
): Promise<DebugResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

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

  const prompt = `
You are a debugging assistant analyzing a crash in a codebase.

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
Analyze the crash and return ONLY a valid JSON object with this structure:
{
  "root_cause_hypothesis": "Your best guess at the root cause (2-3 sentences)",
  "fix_suggestions": ["concrete fix 1", "concrete fix 2", "concrete fix 3"],
  "verification_steps": ["step to verify fix 1", "step 2", "step 3"],
  "confidence": "high | medium | low",
  "requires_runtime_check": true | false
}

Rules:
- Be specific: Reference exact file names and line numbers when possible
- Prioritize UPSTREAM files (callers) over DOWNSTREAM (callees)
- If confidence is low, say so and suggest what additional info you'd need
- Set requires_runtime_check=true if the error is likely env/state/data-related
- Return ONLY the JSON, no markdown, no backticks, no extra text
`;

  let res: Response | undefined;

  for (let attempt = 1; attempt <= 3; attempt++) {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 },
      }),
    });

    if (res.ok) break;

    if ((res.status === 503 || res.status === 429) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 3000 * attempt));
      continue;
    }

    throw new Error(`Gemini API error: ${res.status}`);
  }

  if (!res || !res.ok) throw new Error("Gemini API failed after retries");

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini");

  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("Gemini returned invalid JSON");
  }

  const clean = text.slice(jsonStart, jsonEnd + 1);
  return JSON.parse(clean) as DebugResult;
}