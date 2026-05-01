
import { NextRequest, NextResponse } from "next/server";

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function POST(req: NextRequest) {
  try {
    const { question, repoContext } = await req.json();

    if (!question || !repoContext) {
      return NextResponse.json({ error: "Context Missing" }, { status: 400 });
    }

    /* ================= DEBUG (RUN THIS ONCE) ================= */
    console.log("==== DEBUG REPO CONTEXT ====");
    console.log("Repo:", repoContext.owner, repoContext.repo);

    console.log(
      "Files (raw):",
      repoContext.files?.slice(0, 10)
    );

    console.log(
      "FileContents:",
      (repoContext.fileContents ?? [])
  .slice(0, 10)
  .map((f) => f.path)
    );

    /* ================= REAL FIX ================= */

    // 🔥 IMPORTANT: use fileContents (not files)
    const fileTree = (repoContext.fileContents || [])
      (repoContext.fileContents ?? [])
  .slice(0, 10)
  .map((f) => f.path)
      .slice(0, 50)
      .join("\n");

    const modules = (repoContext.analysis?.key_modules || [])
      (repoContext.analysis?.key_modules ?? [])
  .slice(0, 20)
  .map((m) => `- ${m.file}: ${m.role}`)
      .join("\n");

    const systemPrompt = `
You are a senior software architect.

You MUST analyze ONLY using the provided repository data.

---

### RULES

- Do NOT assume web project unless HTML dominance is clearly visible
- If data is insufficient → say "Insufficient data"
- NEVER hallucinate files
- NEVER invent architecture
- Keep response clean and structured

---

### REPOSITORY DATA

Primary Language:
${repoContext.language || "unknown"}

Detected Architecture:
${repoContext.analysis?.architecture_pattern || "unknown"}

Files:
${fileTree || "No files provided"}

Modules:
${modules || "No modules detected"}

---

### OUTPUT FORMAT

### Overview

Short technical summary

### Components

- bullet points

### Architecture

Explain interactions

### Limitations

Only if needed
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
        max_tokens: 900,
      }),
    });

    const data = await res.json();

    let answer =
      data?.choices?.[0]?.message?.content ||
      "Insufficient structured data";

    /* ================= HARD ANTI-HALLUCINATION FILTER ================= */

    const lower = answer.toLowerCase();

    const wrongWebGuess =
      lower.includes("index.html") ||
      lower.includes("main.js") ||
      lower.includes("style.css") ||
      lower.includes("html project");

    const hasCppFiles = (repoContext.fileContents ?? []).some(
  (f) => f.path.endsWith(".cpp") || f.path.endsWith(".h")
);

    if (hasCppFiles && wrongWebGuess) {
      answer =
        "Insufficient structured data to produce a reliable architectural breakdown.";
    }

    /* ================= CLEAN OUTPUT ================= */

    answer = answer
      .replace(/\*\*/g, "")
      .replace(/={3,}/g, "")
      .replace(/-{3,}/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return NextResponse.json({ answer });

  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Analysis Failed" },
      { status: 500 }
    );
  }
}