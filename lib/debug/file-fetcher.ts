// lib/debug/file-fetcher.ts

import { TraversalNode } from "./types";
import { fetchFileContent } from "@/lib/github";

// Consistent line limit used for both GitHub-fetched and
// existing file content — prevents the 100 vs 300 mismatch.
const MAX_LINES_PER_FILE = 300;

export async function fetchMissingFiles(
  traversalPath: TraversalNode[],
  existingContents: Map<string, string>,
  owner: string,
  repo: string,
  providerToken?: string
): Promise<Map<string, string>> {
  const missing = traversalPath
    .filter((n) => !existingContents.has(n.file))
    .slice(0, 10);

  const fetched = new Map(existingContents);

  if (missing.length === 0) return fetched;

  // ── Parallel fetch ──────────────────────────────────────────────────────────
  // Previously sequential — each file waited for the prior one.
  // Promise.allSettled fetches all missing files concurrently and
  // handles individual failures without aborting the entire batch.
  const results = await Promise.allSettled(
    missing.map((node) =>
      fetchFileContent(owner, repo, node.file, providerToken).then(
        (content) => ({ file: node.file, content })
      )
    )
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      const { file, content } = result.value;
      fetched.set(
        file,
        content.split("\n").slice(0, MAX_LINES_PER_FILE).join("\n")
      );
    } else {
      // Find the node that failed to log it properly
      const failedFile = missing[results.indexOf(result)]?.file ?? "unknown";
      console.warn(`[file-fetcher] Failed to fetch ${failedFile}:`, result.reason);
      fetched.set(failedFile, "// Content not available");
    }
  }

  return fetched;
}

export function extractLineContext(
  content: string,
  crashLine: number,
  contextLines: number = 10
): { start: number; end: number; snippet: string } {
  const lines = content.split("\n");
  const start = Math.max(0, crashLine - contextLines);
  const end = Math.min(lines.length, crashLine + contextLines);

  const snippet = lines
    .slice(start, end)
    .map((line, i) => {
      const lineNum = start + i + 1;
      const marker = lineNum === crashLine ? ">>> " : "    ";
      return `${marker}${lineNum.toString().padStart(4, " ")} | ${line}`;
    })
    .join("\n");

  return { start: start + 1, end, snippet };
}