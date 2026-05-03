import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr"; 
import { checkUsageLimit } from "@/lib/usage"; // ✨ Import the Shield helper

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { owner, repo, prNumber } = body;

    if (!owner || !repo || !prNumber) {
      return NextResponse.json({ error: "Missing parameters." }, { status: 400 });
    }

    // --- 1. Identify the User via Supabase ---
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(name: string) { return cookieStore.get(name)?.value; } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // Ensure the user is actually logged in
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

    // ✨ THE SHIELD: Check usage limit before spending tokens (with Admin Bypass) ✨
    const isUnderLimit = await checkUsageLimit(supabase, user.id, user.email);
    if (!isUnderLimit) {
      return NextResponse.json(
        { 
          error: "RATE_LIMIT_REACHED", 
          message: "Daily limit of 10 scans reached. Please upgrade to the Architect tier to continue." 
        }, 
        { status: 429 }
      );
    }

    // --- 2. Fetch PR Metadata & Diffs ---
    const prMetaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, { headers: { Accept: "application/vnd.github.v3+json" } });
    if (!prMetaRes.ok) throw new Error("Pull Request not found.");
    const prMeta = await prMetaRes.json();

    const prFilesRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`, { headers: { Accept: "application/vnd.github.v3+json" } });
    const prFiles = await prFilesRes.json();

    const fileChangesText = prFiles.slice(0, 15).map((f: { patch?: string; filename: string; status: string }) => {
      const patch = f.patch ? f.patch.substring(0, 1500) : "Binary/large file.";
      return `=== FILE: ${f.filename} (Status: ${f.status}) ===\n${patch}`;
    }).join("\n\n");

    // --- 3. Prompt & Groq Call ---
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
  "description": "A 2-sentence plain English summary.",
  "blastRadius": [{ "file": "exact filename", "impact": "1 sentence explaining impact." }],
  "architecturalChanges": ["bullet point 1", "bullet point 2"],
  "breakingDependencies": ["list any dependencies. If none, write 'None detected.'"],
  "riskLevel": "one of: low | medium | high"
}`;

    const apiKey = process.env.GROQ_API_KEY;
    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: "Analyze this PR and return ONLY the required JSON." }],
        temperature: 0.1,
        response_format: { type: "json_object" }
      }),
    });

    if (!groqRes.ok) throw new Error(`Groq API error ${groqRes.status}`);
    const data = await groqRes.json();
    const finalResult = JSON.parse(data.choices[0].message.content);

    // --- 4. SAVE TO SUPABASE BEFORE RETURNING! ---
    const { error: dbError } = await supabase.from('pr_analyses').insert({
      user_id: user.id,
      repo_name: `${owner}/${repo}`,
      pr_number: prNumber,
      title: finalResult.title,
      risk_level: finalResult.riskLevel,
      analysis_data: finalResult // We save the whole JSON so the user can view it later without recalling the API!
    });
    
    if (dbError) console.error("Failed to save PR analysis to Supabase:", dbError);

    return NextResponse.json(finalResult);

  } catch (error: unknown) {
    console.error("PR Analysis Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to analyze Pull Request." }, { status: 500 });
  }
}