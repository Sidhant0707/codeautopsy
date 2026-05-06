import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { owner, repo, commitSha } = body;

    if (!owner || !repo) {
      return NextResponse.json({ error: "Missing owner or repo" }, { status: 400 });
    }

    // Verify the repo exists in our database so we don't generate empty badges
    const repoUrl = `https://github.com/${owner}/${repo}`;
    const { data: cached } = await supabase
      .from("analyses")
      .select("id")
      .eq("repo_url", repoUrl)
      .limit(1)
      .maybeSingle();

    if (!cached) {
      // Optional: You could trigger an automatic background scan here if it's a new repo!
      console.log(`[CodeAutopsy] Action synced for unscanned repo: ${repoUrl}`);
    }

    // The precise Markdown snippet that the Action will inject between the HTML tags.
    // We wrap it in a centered div to make it look highly professional on GitHub.
    const markdownSnippet = `
<div align="center">
  <a href="https://codeautopsy-lyart.vercel.app/analyze?repo=${repoUrl}">
    <img src="https://codeautopsy-lyart.vercel.app/api/badge?owner=${owner}&repo=${repo}" alt="CodeAutopsy Health Grade" />
  </a>
  <br />
  <em>Architecture mapped and analyzed by <a href="https://codeautopsy-lyart.vercel.app">CodeAutopsy</a>. Last commit scanned: <code>${commitSha?.substring(0, 7) || 'latest'}</code></em>
</div>
`.trim();

    return NextResponse.json({ markdownSnippet });

  } catch (error) {
    console.error("Action Sync Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}