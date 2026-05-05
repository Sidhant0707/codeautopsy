

import { TraversalNode } from "./types";
import { fetchFileContent } from "@/lib/github";

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

  for (const node of missing) {
    try {
      const content = await fetchFileContent(
        owner,
        repo,
        node.file,
        providerToken
      );
      
      fetched.set(node.file, content.split("\n").slice(0, 100).join("\n"));
    } catch (err) {
      console.warn(`Failed to fetch ${node.file}:`, err);
      
      fetched.set(node.file, "// Content not available");
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