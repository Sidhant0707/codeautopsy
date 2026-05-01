import { NextRequest, NextResponse } from "next/server";

// Sets timeout to 60s for the 70b model analysis (Vercel Pro/Railway)
export const maxDuration = 60; 
export const dynamic = 'force-dynamic';

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Simple interfaces to stop TypeScript "Implicit Any" errors
interface RepoFile {
  path: string;
  content?: string;
}

interface RepoModule {
  file: string;
  role: string;
}

export async function POST(req: NextRequest) {
  try {
    const { question, repoContext } = await req.json();

    if (!question || !repoContext) {
      return NextResponse.json({ error: "Context Missing" }, { status: 400 });
    }

    /* ================= DATA EXTRACTION ================= */

    // Fix: Explicitly type 'f' and 'm' to resolve Vercel build errors
    const fileTree = (repoContext.fileContents as RepoFile[] ?? [])
      .slice(0, 50)
      .map((f: RepoFile) => f.path)
      .join("\n");

    const modules = (repoContext.analysis?.key_modules as RepoModule[] ?? [])
      .slice(0, 20)
      .map((m: RepoModule) => `- ${m.file}: ${m.role}`)
      .join("\n");

    const systemPrompt = `
You are a senior software architect. Analyze ONLY using the provided repository data.

### RULES
- Do NOT assume web project unless HTML dominance is clearly visible.
- If data is insufficient → say "Insufficient data".
- NEVER hallucinate files or architecture.
- Keep response clean, structured, and airy.

### REPOSITORY DATA
Primary Language: ${repoContext.language || "unknown"}
Detected Architecture: ${repoContext.analysis?.architecture_pattern || "unknown"}

Files:
${fileTree || "No files provided"}

Modules:
${modules || "No modules detected"}

### OUTPUT FORMAT
### Overview
### Components
### Architecture
### Limitations (if any)
`;

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
          { role: "user", content: question },
        ],
        temperature: 0.2,
        max_tokens: 1024,
      }),
    });

    if (!res.ok) {
      throw new Error(`Groq API Error: ${res.status}`);
    }

    const data = await res.json();
    let answer = data?.choices?.[0]?.message?.content || "Insufficient structured data";

    /* ================= ANTI-HALLUCINATION FILTER ================= */
    const lower = answer.toLowerCase();
    const wrongWebGuess = 
      lower.includes("index.html") || 
      lower.includes("main.js") || 
      lower.includes("style.css");

    const hasCppFiles = (repoContext.fileContents as RepoFile[] ?? []).some(
      (f: RepoFile) => f.path.endsWith(".cpp") || f.path.endsWith(".h")
    );

    if (hasCppFiles && wrongWebGuess) {
      answer = "Insufficient structured data to produce a reliable architectural breakdown for this C++ codebase.";
    }

    /* ================= CLEAN OUTPUT ================= */
    answer = answer
      .replace(/={3,}/g, "")
      .replace(/-{3,}/g, "")
      .replace(/^(?!\s*#)\*\*(.*?)\*\*\s*$/gm, "### $1") // Fix bold lines as headers
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return NextResponse.json({ answer });

  } catch (err) {
    console.error("API Route Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis Failed" },
      { status: 500 }
    );
  }
}