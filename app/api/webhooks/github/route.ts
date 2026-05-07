import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SECRET_PATTERNS = [
  /(ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36}/, 
  /gsk_[a-zA-Z0-9]{32}/,                   
  /sk-[a-zA-Z0-9]{32,128}/,                
  /AKIA[0-9A-Z]{16}/,                      
  /xox[baprs]-[a-zA-Z0-9]{10,}/,           
  /AIza[0-9A-Za-z\-_]{35}/                 
];

export async function POST(req: NextRequest) {
  try {
    const eventType = req.headers.get("x-github-event");
    if (eventType !== "pull_request") {
      return NextResponse.json({ message: "Ignored non-PR event" }, { status: 200 });
    }

    const body = await req.json();
    const { action, pull_request, repository } = body;

    if (action === "opened" || action === "synchronize") {
      const owner = repository.owner.login;
      const repo = repository.name;
      const prNumber = pull_request.number;

      const diffRes = await fetch(pull_request.diff_url, {
        headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
      });
      const diffText = await diffRes.text();

      const hasSecrets = SECRET_PATTERNS.some((pattern) => pattern.test(diffText));

      if (hasSecrets) {
        await fetch(
          `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
              "Content-Type": "application/json",
              "Accept": "application/vnd.github+json",
            },
            body: JSON.stringify({ 
              body: `### 🚨 CRITICAL SECURITY ALERT\n**Risk Level:** ☠️ FATAL\n\nCodeAutopsy scanners detected a hardcoded secret or API key in this diff. The AI review was aborted to prevent leaking secrets to third-party LLMs. Please revoke the exposed key immediately.` 
            }),
          }
        );
        return NextResponse.json({ success: true, blocked: "secrets_found" }, { status: 202 });
      }

      const chatCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: "user",
            content: `You are a pragmatic Senior Software Engineer reviewing a GitHub Pull Request.
Analyze this code diff and provide a concise "Autopsy Report".

RULES:
1. If the changes are strictly to documentation (like README.md) or formatting, set "Risk Level: 🟢 LOW" and state that it is a safe documentation update.
2. If the changes affect core logic, components, or API routes, evaluate the risk as 🟡 MEDIUM or 🔴 HIGH based on the blast radius.
3. Keep it factual, professional, and do not be overly dramatic.

DIFF:
${diffText}`
          }
        ],
        model: "llama-3.1-8b-instant",
      });

      const aiReport = chatCompletion.choices[0]?.message?.content || "Analysis failed.";

      await fetch(
        `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
            "Content-Type": "application/json",
            "Accept": "application/vnd.github+json",
          },
          body: JSON.stringify({ body: `### 🕵️ CodeAutopsy AI Analysis\n${aiReport}` }),
        }
      );
    }

    return NextResponse.json({ success: true }, { status: 202 });
  } catch (error) {
    console.error("🔥 GROQ WEBHOOK CRASHED:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}