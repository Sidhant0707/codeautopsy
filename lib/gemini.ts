import OpenAI from "openai";
import { Tracer, wrapOpenAI } from "0xtrace";

// ── Base Groq client (unwrapped) ──────────────────────────────────────────────
// Wrapped per-call inside streamAnalyzeWithGemini so each repo analysis
// gets its own session in the 0xtrace dashboard.
const baseGroq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY!,
  baseURL: "https://api.groq.com/openai/v1",
});

// ── Main Streaming Function ───────────────────────────────────────────────────

export async function streamAnalyzeWithGemini(
  repoName: string,
  description: string,
  entryPoints: string[],
  topFiles: { path: string; role: string }[],
  fileContents: { path: string; content: string }[],
  blastRadiusTargets: { file: string; dependentsCount: number }[],
  healthMetrics: { score: number; grade: string; color: string; status: string }
) {
  if (process.env.USE_GROQ_FOR_ANALYSIS !== "true") {
    throw new Error("Groq analysis is disabled. Set USE_GROQ_FOR_ANALYSIS=true.");
  }

  // 1. Per-analysis tracer (100% PRESERVED FOR TELEMETRY)
  const tracer = new Tracer({
    ingestUrl: process.env.INGEST_URL ?? "http://localhost:3000/api/ingest",
    apiKey: process.env.INGEST_API_KEY!,
    sessionId: crypto.randomUUID(),
    metadata: { repo: repoName },
  });

  const groq = wrapOpenAI(baseGroq, tracer);

  // 2. Build the optimized context text
  // Cap at 20 files — topFiles already identifies the most important ones.
  // On large repos this prevents runaway token spend with zero quality loss.
  const fileContentText = fileContents
    .slice(0, 20)
    .map((f) => {
      const optimized = f.content
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*/g, "")
        .replace(/\s+/g, " ")
        .trim();
      return `=== ${f.path} ===\n${optimized.slice(0, 2000)}`;
    })
    .join("\n\n");

  // 3. System Prompt (Explicit JSON structure required since we aren't using Zod)
  const systemPrompt = `You are a senior software engineer analyzing a GitHub repository.

Repository: ${repoName}
Description: ${description}
Entry Points: ${entryPoints.join(", ")}
Important Files: ${topFiles.map((f) => f.path).join(", ")}
High-Risk Blast Radius Targets: ${JSON.stringify(blastRadiusTargets)}

CRITICAL ARCHITECTURE METRICS:
- Health Grade: ${healthMetrics.grade} (Score: ${healthMetrics.score}/100)
- System Status: ${healthMetrics.status}

Because this codebase has a grade of ${healthMetrics.grade}, you MUST include a specific, actionable 3-step refactoring plan designed to fix the architectural bottlenecks and raise the score to an A. Do not give generic advice. Be specific to the provided files.

FILE CONTENTS:
${fileContentText}

Analyze this codebase and return ONLY a valid JSON object with exactly this structure:
{
  "architecture_pattern": "string",
  "what_it_does": "string",
  "execution_flow": ["string"],
  "tech_stack": [{ "name": "string", "purpose": "string" }],
  "key_modules": [{ "file": "string", "role": "string", "why_it_exists": "string" }],
  "onboarding_guide": ["string"],
  "evidence_paths": ["string"],
  "blast_radius": [{ "file": "string", "dependents": 0, "warning": "string", "safe_refactor_steps": ["string"] }],
  "health_status": { "grade": "string", "score": 0, "status": "string", "refactor_plan": ["string"] }
}`;

  // 4. Execute the call with `stream: true` so 0xtrace can intercept it
  const response = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Analyze this codebase and stream ONLY the required JSON." }
    ],
    temperature: 0.2,
    response_format: { type: "json_object" },
    stream: true, // <--- THE MAGIC KEY FOR 0XTRACE
  });

  // 5. Native Web Stream (Replaces deprecated Vercel OpenAIStream)
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Iterate through the AI chunks as they arrive
        for await (const chunk of response) {
          const text = chunk.choices[0]?.delta?.content || "";
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
      } catch (error) {
        console.error("AI Stream Error:", error);
      } finally {
        // The exact millisecond the stream is fully generated, flush the trace
        await tracer.flush();
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    }
  });
}