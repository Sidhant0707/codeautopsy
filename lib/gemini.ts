export interface AnalysisResult {
  architecture_pattern: string;
  what_it_does: string;
  execution_flow: string[];
  tech_stack: { name: string; purpose: string }[];
  key_modules: { file: string; role: string; why_it_exists: string }[];
  onboarding_guide: string[];
  evidence_paths: string[];
  blast_radius: { file: string; dependents: number; warning: string; safe_refactor_steps: string[] }[];
  
  health_status: {
    grade: string;
    score: number;
    status: string;
    refactor_plan: string[];
  };
}

export async function analyzeWithGemini(
  repoName: string,
  description: string,
  entryPoints: string[],
  topFiles: { path: string; role: string }[],
  fileContents: { path: string; content: string }[],
  blastRadiusTargets: { file: string; dependentsCount: number }[],
  
  healthMetrics: { score: number; grade: string; color: string; status: string } 
): Promise<AnalysisResult> {
  if (process.env.USE_GROQ_FOR_ANALYSIS !== 'true') {
    throw new Error("Gemini is currently disabled. Please use Groq. Check Vercel Env Variables.");
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY environment variable");
  }

  const url = "https://api.groq.com/openai/v1/chat/completions";

  const fileContentText = fileContents
    .map((f) => {
      const optimized = f.content
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      const trimmed = optimized.slice(0, 2000);
      return `=== ${f.path} ===\n${trimmed}`;
    })
    .join("\n\n");

  
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
  "architecture_pattern": "one of: MVC | Microservices | Monolith | Serverless | Event-driven | Library | CLI | Other",
  "what_it_does": "2-3 sentence plain English explanation of what this project does",
  "execution_flow": ["step 1", "step 2", "step 3"],
  "tech_stack": [{ "name": "technology name", "purpose": "what it does in this project" }],
  "key_modules": [{ "file": "exact filename from the list above", "role": "short role name", "why_it_exists": "one sentence explanation" }],
  "onboarding_guide": ["first thing a new dev should know", "second thing", "third thing"],
  "evidence_paths": ["list of files you actually used to draw your conclusions"],
  "blast_radius": [
    {
      "file": "exact filename from High-Risk Blast Radius Targets",
      "dependents": 0,
      "warning": "Explain exactly what features or downstream systems will break if a junior dev edits this file incorrectly.",
      "safe_refactor_steps": ["step 1 to safely modify", "step 2"]
    }
  ],
  "health_status": {
    "grade": "${healthMetrics.grade}",
    "score": ${healthMetrics.score},
    "status": "${healthMetrics.status}",
    "refactor_plan": ["step 1 specific refactor", "step 2 specific refactor", "step 3 specific refactor"]
  }
}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { 
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: "Analyze this codebase and return ONLY the required JSON." }
      ],
      temperature: 0.2,
      response_format: { type: "json_object" }
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Groq API error ${res.status}: ${errorText}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  
  if (!text) throw new Error("Empty response from Groq");

  return JSON.parse(text) as AnalysisResult;
}