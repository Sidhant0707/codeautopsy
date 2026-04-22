// lib/debug/stack-parser.ts

import { CrashNode } from "./types";

const FRAMEWORK_NOISE = [
  "node_modules/",
  "webpack:",
  "<anonymous>",
  ".next/",
  "react-dom/",
  "next/dist/",
  "node:internal/",
  "_middleware",
  "at eval",
  "at processTicksAndRejections",
  "at async",
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

export function parseStackTrace(
  trace: string,
  allFiles: string[]
): CrashNode | null {
  const lines = trace.split("\n");
  const frames: StackFrame[] = [];

  for (const line of lines) {
    // Skip empty lines and error messages
    if (!line.trim() || !line.includes("at ")) continue;

    // Extract file path and location
    // Matches: "at functionName (/path/to/file.ts:42:10)"
    // Also matches: "at /path/to/file.ts:42:10"
    const match = line.match(
      /at\s+(?:(.+?)\s+\()?([^()]+):(\d+):(\d+)\)?/
    );

    if (!match) continue;

    const functionName = match[1]?.trim();
    const filePath = match[2];
    const lineNum = parseInt(match[3]);
    const colNum = parseInt(match[4]);

    // Filter out framework noise
    if (FRAMEWORK_NOISE.some((noise) => filePath.includes(noise))) {
      continue;
    }

    frames.push({
      file: filePath,
      line: lineNum,
      column: colNum,
      function: functionName,
      raw: line,
    });
  }

  // Now map extracted paths to actual repository files
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

  return null; // No valid crash node found
}

function findMatchingFile(framePath: string, allFiles: string[]): string | null {
  // 1. Try exact match
  if (allFiles.includes(framePath)) return framePath;

  // 2. Try extracting just the filename
  const filename = framePath.split("/").pop();
  if (filename) {
    const match = allFiles.find((f) => f.endsWith(filename));
    if (match) return match;
  }

  // 3. Try partial path matching (last 2 segments)
  const segments = framePath.split("/");
  if (segments.length >= 2) {
    const partial = segments.slice(-2).join("/");
    const match = allFiles.find((f) => f.endsWith(partial));
    if (match) return match;
  }

  // 4. Try matching against repo root patterns
  for (const pattern of REPO_ROOT_PATTERNS) {
    const idx = framePath.indexOf(pattern);
    if (idx !== -1) {
      const repoPath = framePath.substring(idx + 1); // Remove leading "/"
      if (allFiles.includes(repoPath)) return repoPath;
    }
  }

  return null;
}

// Extract error type and message from stack trace
export function extractErrorInfo(trace: string): {
  error_type: string;
  error_message: string;
} {
  const lines = trace.split("\n");
  const firstLine = lines[0]?.trim() || "";

  // Try to extract "ErrorType: message"
  const errorMatch = firstLine.match(/^(\w+Error):\s*(.+)$/);

  if (errorMatch) {
    return {
      error_type: errorMatch[1],
      error_message: errorMatch[2],
    };
  }

  // Fallback: use first line as message
  return {
    error_type: "UnknownError",
    error_message: firstLine || "No error message provided",
  };
}

// Edge case handler: Multiple errors in one trace
export function extractAllCrashNodes(
  trace: string,
  allFiles: string[]
): CrashNode[] {
  const lines = trace.split("\n");
  const crashes: CrashNode[] = [];

  for (const line of lines) {
    const node = parseStackTrace(line, allFiles);
    if (node && !crashes.some((c) => c.file === node.file)) {
      crashes.push(node);
    }
  }

  return crashes;
}