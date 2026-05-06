import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr"; 
import { checkUsageLimit } from "@/lib/usage"; 
import { getFileContributors } from "@/lib/github/pr-fetcher";

function scanForSecrets(text: string): string[] {
  const alerts: string[] = [];
  
  if (/(AKIA|A3T[A-Z0-9]|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/.test(text)) {
    alerts.push("Exposed AWS Access Key");
  }
  if (/(?:api_key|apikey|secret|password|token)(?:["'\s:=]+)(?:["']?)([a-zA-Z0-9\-_]{20,})(?:["']?)/i.test(text)) {
    alerts.push("Potential hardcoded Secret/Token");
  }
  if (/-----BEGIN (RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY-----/.test(text)) {
    alerts.push("Exposed Private Key");
  }
  
  return alerts;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { owner, repo, prNumber } = body;

    if (!owner || !repo || !prNumber) {
      return NextResponse.json({ error: "Missing parameters." }, { status: 400 });
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(name: string) { return cookieStore.get(name)?.value; } } }
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 });
    }

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

    const prMetaRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`, { 
      headers: { Accept: "application/vnd.github.v3+json" } 
    });
    
    if (!prMetaRes.ok) throw new Error("Pull Request not found.");
    const prMeta = await prMetaRes.json();

    const prFilesRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`, { 
      headers: { Accept: "application/vnd.github.v3+json" } 
    });
    const prFiles = await prFilesRes.json();

    const securityAlerts: string[] = [];

    const filePromises = prFiles.slice(0, 15).map(async (f: { patch?: string; filename: string; status: string }) => {
      const patch = f.patch ? f.patch.substring(0, 1500) : "Binary/large file.";
      
      const secretsFound = scanForSecrets(patch);
      if (secretsFound.length > 0) {
        securityAlerts.push(`CRITICAL ALERT in ${f.filename}: ${secretsFound.join(', ')}`);
      }

      const authors = await getFileContributors(owner, repo, f.filename, process.env.GITHUB_TOKEN);
      const authorText = authors.length > 0 ? authors.join(", ") : "Unknown/New File";
      
      return `=== FILE: ${f.filename} (Status: ${f.status}) ===\nHistorical Authors: ${authorText}\n${patch}`;
    });

    const fileChangesArray = await Promise.all(filePromises);
    const fileChangesText = fileChangesArray.join("\n\n");

    const systemPrompt = `You are a senior software engineer conducting a strict code review on a Pull Request.
Repository: ${owner}/${repo}
PR Title: ${prMeta.title}
PR Description: ${prMeta.body ? prMeta.body.substring(0, 1000) : "No description."}
CODE CHANGES (Diffs & File Authors):
${fileChangesText}

Analyze these code changes and return ONLY a valid JSON object with EXACTLY this structure:
{
  "prNumber": ${prNumber},
  "title": "${prMeta.title.replace(/"/g, '\\"')}",
  "description": "A 2-sentence plain English summary.",
  "blastRadius": [{ "file": "exact filename", "impact": "1 sentence explaining impact." }],
  "architecturalChanges": ["bullet point 1", "bullet point 2"],
  "breakingDependencies": ["list any dependencies. If none, write 'None detected.'"],
  "riskLevel": "one of: low | medium | high",
  "suggestedReviewers": [
    {
      "username": "github_handle",
      "reason": "1 short sentence explaining why they should review this based on Historical Authors data."
    }
  ]
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

    if (securityAlerts.length > 0) {
      finalResult.riskLevel = "high";
      
      if (!finalResult.blastRadius) finalResult.blastRadius = [];
      
      securityAlerts.forEach(alert => {
        finalResult.blastRadius.unshift({
          file: "SECURITY BREACH",
          impact: alert
        });
      });
    }

    const { error: dbError } = await supabase.from('pr_analyses').insert({
      user_id: user.id,
      repo_name: `${owner}/${repo}`,
      pr_number: prNumber,
      title: finalResult.title,
      risk_level: finalResult.riskLevel,
      analysis_data: finalResult 
    });
    
    if (dbError) console.error("Failed to save PR analysis to Supabase:", dbError);

    return NextResponse.json(finalResult);

  } catch (error: unknown) {
    console.error("PR Analysis Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to analyze Pull Request." }, { status: 500 });
  }
}