import { NextResponse } from "next/server";
import { getPullRequestDiff } from "@/lib/github/pr-fetcher";
import { calculateBlastRadius } from "@/lib/analyzer/blast-radius";

export async function POST(req: Request) {
  try {
    const { prUrl } = await req.json();

    if (!prUrl) {
      return NextResponse.json({ error: "Missing PR URL" }, { status: 400 });
    }

    // 1. Fetch the modified files from the PR using the GitHub token from your .env
    const prData = await getPullRequestDiff(prUrl, process.env.GITHUB_TOKEN);
    const modifiedFiles = prData.modifiedFiles.map((f: any) => f.filename);

    // 2. Fetch the repository's dependency graph.
    // NOTE: You will eventually plug in your actual graph generator here, 
    // or fetch the cached graph from Supabase for this specific repo.
    // For now, we use a mock graph to ensure the wiring works.
    const reverseDependencyGraph: Record<string, string[]> = {
      "app/page.tsx": [],
      "components/ui/button.tsx": ["app/page.tsx", "components/layout/header.tsx"],
      "lib/auth.ts": ["app/api/user/route.ts", "components/layout/header.tsx", "app/dashboard/page.tsx"],
    };

    // 3. Calculate the Blast Radius mathematically
    const blastRadius = calculateBlastRadius(modifiedFiles, reverseDependencyGraph);

    // 4. Return the enterprise-grade impact report
    return NextResponse.json({
      success: true,
      repository: `${prData.owner}/${prData.repo}`,
      pullRequest: prData.pullNumber,
      modifiedFilesCount: modifiedFiles.length,
      impactReport: blastRadius,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}