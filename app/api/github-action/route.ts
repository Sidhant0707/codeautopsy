import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    // Parse the incoming request from your GitHub Action
    const body = await req.json();
    const { owner, repo, commitSha } = body;

    // Validate that all required payload data is present
    if (!owner || !repo || !commitSha) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const shortSha = commitSha.substring(0, 7);
    const reportUrl = `https://codeautopsy-lyart.vercel.app/analyze?url=https://github.com/${owner}/${repo}`;

    // Generate the dynamic markdown snippet that the Action will inject into the README.
    // We wrap it in the specific start/end tags so the Action knows exactly what to replace next time.
    const markdownSnippet = `
<!-- CODEAUTOPSY:START -->
<div align="center">
  <h3>🧠 Architecture Analyzed by CodeAutopsy</h3>
  <p>Latest commit scanned: <code>${shortSha}</code></p>
  <a href="${reportUrl}">
    <img src="https://img.shields.io/badge/View_Interactive_Graph-CodeAutopsy-4f46e5?style=for-the-badge" alt="View Architecture Graph" />
  </a>
</div>
<!-- CODEAUTOPSY:END -->
`.trim();

    // Send the generated markdown back to the GitHub Action
    return NextResponse.json({ markdownSnippet });

  } catch (error: unknown) {
    console.error("CodeAutopsy Action API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}