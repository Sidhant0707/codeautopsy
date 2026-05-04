export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// We use the standard supabase-js client here because this is a public GET request
// triggered by GitHub's image caching servers. There are no cookies to pass.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const repoParam = searchParams.get("repo");

    if (!repoParam) {
      return new NextResponse("Missing repo parameter", { status: 400 });
    }

    // Handle both raw "owner/repo" and full "https://github.com/owner/repo" formats
    const repoPath = repoParam.replace("https://github.com/", "").replace(".git", "");
    const repoUrl = `https://github.com/${repoPath}`;

    // Look up the latest analysis for this repository
    const { data: cached } = await supabase
      .from("analyses")
      .select("result_json")
      .eq("repo_url", repoUrl)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Default Fallback values if the repo hasn't been scanned yet
    let grade = "-";
    let score = "0";
    let colorHex = "#64748b"; // Slate-500
    let statusText = "Unscanned";

    // If we have data, extract the exact metrics your AI generated
    if (cached?.result_json?.healthMetrics) {
      const metrics = cached.result_json.healthMetrics;
      grade = metrics.grade;
      score = metrics.score.toString();
      statusText = metrics.status || "Analyzed";

      // Match the exact Tailwind colors from our UI
      if (grade === "A") colorHex = "#10b981"; // Emerald-500
      else if (grade === "B") colorHex = "#3b82f6"; // Blue-500
      else if (grade === "C") colorHex = "#f59e0b"; // Amber-500
      else if (grade === "D") colorHex = "#f97316"; // Orange-500
      else if (grade === "F") colorHex = "#ef4444"; // Red-500
    }

    // Generate the raw SVG string
    // This creates a sleek, dark-mode badge matching your UI aesthetics
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="280" height="40" viewBox="0 0 280 40" fill="none">
        <rect width="280" height="40" rx="6" fill="#0e0e0e" stroke="#222222" stroke-width="1.5"/>
        
        <!-- Glowing Letter Grade Box -->
        <rect x="4" y="4" width="32" height="32" rx="4" fill="${colorHex}15" stroke="${colorHex}40" stroke-width="1"/>
        <text x="20" y="26" font-family="monospace" font-size="20" font-weight="900" fill="${colorHex}" text-anchor="middle">${grade}</text>
        
        <!-- CodeAutopsy Branding -->
        <text x="48" y="16" font-family="sans-serif" font-size="9" font-weight="700" fill="#64748b" letter-spacing="1">CODEAUTOPSY HEALTH</text>
        
        <!-- Status & Score -->
        <text x="48" y="30" font-family="sans-serif" font-size="12" font-weight="600" fill="#e2e8f0">${statusText}</text>
        
        <!-- Score Pill -->
        <rect x="230" y="10" width="40" height="20" rx="10" fill="${colorHex}20" />
        <text x="250" y="24" font-family="monospace" font-size="10" font-weight="bold" fill="${colorHex}" text-anchor="middle">${score}</text>
      </svg>
    `;

    // Return the SVG with aggressive caching headers to prevent spamming your database
    return new NextResponse(svg.trim(), {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      },
    });

  } catch (error) {
    console.error("Badge generation error:", error);
    return new NextResponse("Error generating badge", { status: 500 });
  }
}