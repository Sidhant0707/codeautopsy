import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { owner, repo, prNumber } = body;

    if (!owner || !repo || !prNumber) {
      return NextResponse.json(
        { error: "Missing required parameters: owner, repo, or prNumber." },
        { status: 400 }
      );
    }

    const prMetaRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`,
      { headers: { Accept: "application/vnd.github.v3+json" } }
    );

    if (!prMetaRes.ok) {
      if (prMetaRes.status === 404) return NextResponse.json({ error: "Pull Request not found." }, { status: 404 });
      throw new Error(`GitHub API Error: ${prMetaRes.statusText}`);
    }
    const prMeta = await prMetaRes.json();

    const prFilesRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`,
      { headers: { Accept: "application/vnd.github.v3+json" } }
    );
    const prFiles = await prFilesRes.json();

    const fileChangesText = prFiles
      .slice(0, 15)
      .map((f: { patch?: string; filename: string; status: string }) => {
        const patch = f.patch ? f.patch.substring(0, 1500) : "Binary or large file.";
        return `=== FILE: ${f.filename} (Status: ${f.status}) ===\n${patch}`;
      })
      .join("\n\n");

    const systemPrompt = `You are a senior software engineer conducting a strict code review on a Pull Request.

Repository: ${owner}/${repo}
PR Title: ${prMeta.title}
PR Description: ${prMeta.body ? prMeta.body.substring(0, 1000) : "No description."}

CODE CHANGES (Diffs):
${fileChangesText}

Analyze these code changes and return ONLY a valid JSON object with EXACTLY this structure:
{
  "prNumber": ${prNumber},
  "title": "${prMeta.title.replace(/"/g, '\\"')}",
  "description": "A 2-sentence plain English summary of what this code actually does.",
  "blastRadius": [
    { 
      "file": "exact filename", 
      "impact": "1 sentence explaining what downstream systems or logic might break due to this change." 
    }
  ],
  "architecturalChanges": ["bullet point 1", "bullet point 2"],
  "breakingDependencies": ["list any dependencies, libraries, or flows this might break. If none, write 'None detected.'"],
  "riskLevel": "one of: low | medium | high"
}`;

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("Missing GROQ_API_KEY environment variable");

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Analyze this PR and return ONLY the required JSON." }
        ],
        temperature: 0.1,
        response_format: { type: "json_object" }
      }),
    });

    if (!groqRes.ok) {
      const errorText = await groqRes.text();
      throw new Error(`Groq API error ${groqRes.status}: ${errorText}`);
    }

    const data = await groqRes.json();
    const text = data.choices?.[0]?.message?.content;
    
    if (!text) throw new Error("Empty response from LLM");

    const finalResult = JSON.parse(text);
    return NextResponse.json(finalResult);

  } catch (error: unknown) {
    console.error("PR Analysis Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze Pull Request." },
      { status: 500 }
    );
  }
}