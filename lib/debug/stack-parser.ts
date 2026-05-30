// lib/debug/stack-parser.ts

import { CrashNode } from "./types";

// ── Noise filters ─────────────────────────────────────────────────────────────
// Previously included "at async" which accidentally filtered valid
// user async functions. Now only exact/prefix noise is listed.
const FRAMEWORK_NOISE = [
  "node_modules/",
  "webpack:",
  "<anonymous>",
  ".next/",
  "react-dom/",
  "next/dist/",
  "node:internal/",
  "_middleware",
  "at eval (",
  "at processTicksAndRejections",
  "at Module.",
  "at Object.",
];

const REPO_ROOT_PATTERNS = [
  "/app/",
  "/src/",
  "/components/",
  "/lib/",
  "/utils/",
  "/pages/",
  "/api/",
  "/hooks/",
  "/services/",
  "/features/",
  "/modules/",
];

interface StackFrame {
  file: string;
  line: number;
  column: number;
  function?: string;
  raw: string;
}

// ── Stack trace parser ────────────────────────────────────────────────────────
export function parseStackTrace(
  trace: string,
  allFiles: string[]
): CrashNode | null {
  const lines = trace.split("\n");
  const frames: StackFrame[] = [];

  for (const line of lines) {
    if (!line.trim() || !line.includes("at ")) continue;

    const match = line.match(
      /at\s+(?:(.+?)\s+\()?([^()]+):(\d+):(\d+)\)?/
    );

    if (!match) continue;

    const functionName = match[1]?.trim();
    const filePath = match[2];
    const lineNum = parseInt(match[3]);
    const colNum = parseInt(match[4]);

    if (FRAMEWORK_NOISE.some((noise) => filePath.includes(noise))) continue;

    frames.push({
      file: filePath,
      line: lineNum,
      column: colNum,
      function: functionName,
      raw: line,
    });
  }

  for (const frame of frames) {
    const matched = findMatchingFile(frame.file, allFiles);
    if (matched) {
      return {
        file: matched,
        line: frame.line,
        column: frame.column,
        function: frame.function,
      };
    }
  }

  return null;
}

// ── File matcher ──────────────────────────────────────────────────────────────
// Previously returned the first filename match without disambiguation.
// Two files with the same name in different folders would silently resolve
// to whichever came first in the array.
// Now: prefers the match whose full path contains more segments from framePath.
function findMatchingFile(framePath: string, allFiles: string[]): string | null {
  // 1. Exact match
  if (allFiles.includes(framePath)) return framePath;

  // 2. Repo-root relative path match
  for (const pattern of REPO_ROOT_PATTERNS) {
    const idx = framePath.indexOf(pattern);
    if (idx !== -1) {
      const repoPath = framePath.substring(idx + 1);
      if (allFiles.includes(repoPath)) return repoPath;
    }
  }

  // 3. Partial path match (last 2 segments) with disambiguation:
  //    score each candidate by how many path segments match the frame
  const frameSegments = framePath.split("/");

  if (frameSegments.length >= 2) {
    const partial = frameSegments.slice(-2).join("/");
    const candidates = allFiles.filter((f) => f.endsWith(partial));

    if (candidates.length === 1) return candidates[0];

    if (candidates.length > 1) {
      // Pick the candidate that shares the most path segments with framePath
      let bestMatch = candidates[0];
      let bestScore = 0;

      for (const candidate of candidates) {
        const candidateSegments = candidate.split("/");
        const score = frameSegments.filter((seg) =>
          candidateSegments.includes(seg)
        ).length;
        if (score > bestScore) {
          bestScore = score;
          bestMatch = candidate;
        }
      }

      return bestMatch;
    }
  }

  // 4. Filename-only fallback (least precise — only used if nothing else matches)
  const filename = frameSegments.pop();
  if (filename) {
    const candidates = allFiles.filter((f) => f.endsWith(filename));
    if (candidates.length === 1) return candidates[0];
    // Multiple files with same name and no better match — return null
    // rather than silently picking the wrong one
    if (candidates.length > 1) return null;
  }

  return null;
}

// ── Error info extractor ──────────────────────────────────────────────────────
export function extractErrorInfo(trace: string): {
  error_type: string;
  error_message: string;
} {
  const firstLine = trace.split("\n")[0]?.trim() || "";
  const errorMatch = firstLine.match(/(?:.*\s)?(\w+Error):\s*(.+)$/);

  if (errorMatch) {
    return {
      error_type: errorMatch[1],
      error_message: errorMatch[2],
    };
  }

  return {
    error_type: "UnknownError",
    error_message: firstLine || "No error message provided",
  };
}