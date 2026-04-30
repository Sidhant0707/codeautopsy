export interface AnalysisResult {
  architecture_pattern: string;
  what_it_does: string;
  execution_flow: string[];
  tech_stack: { name: string; purpose: string }[];
  key_modules: { file: string; role: string; why_it_exists: string }[];
  onboarding_guide: string[];
  evidence_paths: string[];
}

export async function analyzeWithGemini(
  repoName: string,
  description: string,
  entryPoints: string[],
  topFiles: { path: string; role: string }[],
  fileContents: { path: string; content: string }[]
): Promise<AnalysisResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
  throw new Error("Missing GEMINI_API_KEY environment variable");
  }
  const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const fileContentText = fileContents
  .map((f) => {
    const trimmed = f.content.slice(0, 1500);
    return `=== ${f.path} ===\n${trimmed}`;
  })
  .join("\n\n");

  const prompt = `
You are a senior software engineer analyzing a GitHub repository.

Repository: ${repoName}
Description: ${description}
Entry Points: ${entryPoints.join(", ")}
Important Files: ${topFiles.map((f) => f.path).join(", ")}

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
  "evidence_paths": ["list of files you actually used to draw your conclusions"]
}

Rules:
- Only reference files I provided above
- Do not invent filenames
- Return only the JSON, no markdown, no backticks, no extra text
`;

  let res: Response | undefined;

  for (let attempt = 1; attempt <= 3; attempt++) {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 }
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
return JSON.parse(clean)  as AnalysisResult;
}


