import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, pull_request, repository } = body;

    if (action === "opened" || action === "synchronize") {
      const owner = repository.owner.login;
      const repo = repository.name;
      const prNumber = pull_request.number;

      const diffRes = await fetch(pull_request.diff_url);
      const diffText = await diffRes.text();

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