import { streamAnalyzeWithGemini } from "@/lib/gemini";
import { NextRequest } from "next/server";

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      repoName, 
      description, 
      entryPoints, 
      topFiles, 
      fileContents, 
      blastRadiusTargets, 
      healthMetrics 
    } = body;

    // 1. Kick off the streaming response from the AI SDK
    const responseStream = await streamAnalyzeWithGemini(
      repoName,
      description,
      entryPoints,
      topFiles,
      fileContents,
      blastRadiusTargets,
      healthMetrics
    );

    // 2. Return the stream directly to the frontend
    return responseStream;

  } catch (error) {
    console.error("AI Streaming Error:", error);
    return new Response(JSON.stringify({ error: "Failed to generate AI analysis stream" }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}