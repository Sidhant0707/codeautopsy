import { NextResponse } from "next/server";
import { getPullRequestDiff } from "@/lib/github/pr-fetcher";
import { calculateBlastRadius } from "@/lib/analyzer/blast-radius";

export async function POST(req: Request) {
  try {
    const { prUrl } = await req.json();

    if (!prUrl) {
      return NextResponse.json({ error: "Missing PR URL" }, { status: 400 });
    }

    
    const prData = await getPullRequestDiff(prUrl, process.env.GITHUB_TOKEN);
    const modifiedFiles = prData.modifiedFiles.map((f: { filename: string }) => f.filename);

    
    
    
    
    const reverseDependencyGraph: Record<string, string[]> = {
      "app/page.tsx": [],
      "components/ui/button.tsx": ["app/page.tsx", "components/layout/header.tsx"],
      "lib/auth.ts": ["app/api/user/route.ts", "components/layout/header.tsx", "app/dashboard/page.tsx"],
    };

    
    const blastRadius = calculateBlastRadius(modifiedFiles, reverseDependencyGraph);

    
    return NextResponse.json({
      success: true,
      repository: `${prData.owner}/${prData.repo}`,
      pullRequest: prData.pullNumber,
      modifiedFilesCount: modifiedFiles.length,
      impactReport: blastRadius,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}