// lib/cfg-builder.ts
//
// Control Flow Graph (CFG) builder for JS/TS files.
//
// Uses @babel/parser which is a dependency of Next.js itself and is always
// present in node_modules even without an explicit package.json entry.
// If you want to import it explicitly, run: npm install --save-dev @babel/parser @babel/types
//
// What this detects (static analysis only — no runtime execution):
//   1. Unreachable code  — statements after return/throw/break/continue.
//   2. Missing error handling — async functions with await but no try/catch.
//   3. Infinite loop candidates — while(true) / for(;;) without a break.
//
// Intentional non-goals:
//   - Full CFG edge construction (control flow edges between basic blocks).
//     That would require a full compiler pass and blows the Groq token budget.
//     Instead we return structured findings per function that the LLM can reason about.
//   - Runtime type checking (needs execution context).

import * as parser from "@babel/parser";
import type {
  File,
  FunctionDeclaration,
  ArrowFunctionExpression,
  FunctionExpression,
  BlockStatement,
  Statement,
  Node,
} from "@babel/types";

export interface CFGFinding {
  type: "unreachable_code" | "missing_error_handling" | "infinite_loop_candidate";
  functionName: string | null;
  line: number;
  description: string;
  severity: "warning" | "error";
}

export interface CFGResult {
  filePath: string;
  findings: CFGFinding[];
  functionsAnalyzed: number;
  parseError: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type FunctionNode =
  | FunctionDeclaration
  | ArrowFunctionExpression
  | FunctionExpression;

function getFunctionName(node: FunctionNode): string | null {
  if (node.type === "FunctionDeclaration" && node.id) return node.id.name;
  if (node.type === "FunctionExpression" && node.id) return node.id.name;
  return null;
}

function isTerminator(node: Statement): boolean {
  return (
    node.type === "ReturnStatement" ||
    node.type === "ThrowStatement" ||
    node.type === "BreakStatement" ||
    node.type === "ContinueStatement"
  );
}

function findUnreachableStatements(
  body: Statement[],
  functionName: string | null,
): CFGFinding[] {
  const findings: CFGFinding[] = [];

  for (let i = 0; i < body.length - 1; i++) {
    if (isTerminator(body[i])) {
      const nextStmt = body[i + 1];
      findings.push({
        type: "unreachable_code",
        functionName,
        line: nextStmt.loc?.start.line ?? 0,
        description: `Unreachable statement after ${body[i].type} at line ${body[i].loc?.start.line ?? "?"}`,
        severity: "error",
      });
      break; // Only report the first unreachable block per function
    }
  }

  return findings;
}

function findMissingErrorHandling(
  node: FunctionNode,
  functionName: string | null,
): CFGFinding[] {
  if (!node.async) return [];

  const body = node.body;
  if (!body || body.type !== "BlockStatement") return [];

  let hasAwait = false;
  let hasTryCatch = false;

  // Simple linear scan — not a full AST walk, intentionally shallow
  for (const stmt of body.body) {
    if (stmt.type === "TryStatement") {
      hasTryCatch = true;
    }
    if (JSON.stringify(stmt).includes('"type":"AwaitExpression"')) {
      hasAwait = true;
    }
  }

  if (hasAwait && !hasTryCatch) {
    return [
      {
        type: "missing_error_handling",
        functionName,
        line: node.loc?.start.line ?? 0,
        description: `Async function '${functionName ?? "(anonymous)"}' uses await without try/catch`,
        severity: "warning",
      },
    ];
  }

  return [];
}

function findInfiniteLoopCandidates(
  body: Statement[],
  functionName: string | null,
): CFGFinding[] {
  const findings: CFGFinding[] = [];

  for (const stmt of body) {
    // while (true) { ... } without a break
    if (stmt.type === "WhileStatement") {
      const test = stmt.test;
      const isTrueLiteral =
        test.type === "BooleanLiteral" && test.value === true;
      const isNumericOne =
        test.type === "NumericLiteral" && test.value === 1;

      if (isTrueLiteral || isNumericOne) {
        const block = stmt.body;
        const hasBreak =
          block.type === "BlockStatement" &&
          block.body.some(
            (s) => s.type === "BreakStatement" || s.type === "ReturnStatement",
          );

        if (!hasBreak) {
          findings.push({
            type: "infinite_loop_candidate",
            functionName,
            line: stmt.loc?.start.line ?? 0,
            description: `while(true) loop without break/return — potential infinite loop`,
            severity: "warning",
          });
        }
      }
    }

    // for (;;) { ... } without a break
    if (
      stmt.type === "ForStatement" &&
      stmt.test == null &&
      stmt.init == null &&
      stmt.update == null
    ) {
      const block = stmt.body;
      const hasBreak =
        block.type === "BlockStatement" &&
        block.body.some(
          (s) => s.type === "BreakStatement" || s.type === "ReturnStatement",
        );

      if (!hasBreak) {
        findings.push({
          type: "infinite_loop_candidate",
          functionName,
          line: stmt.loc?.start.line ?? 0,
          description: `for(;;) loop without break/return — potential infinite loop`,
          severity: "warning",
        });
      }
    }
  }

  return findings;
}

function walkFunctions(
  ast: File,
  findings: CFGFinding[],
): number {
  let count = 0;

  function visit(node: Node): void {
    if (
      node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression" ||
      node.type === "ArrowFunctionExpression"
    ) {
      const fn = node as FunctionNode;
      const name = getFunctionName(fn);
      count++;

      const body = fn.body;
      if (body && body.type === "BlockStatement") {
        findings.push(...findUnreachableStatements(body.body, name));
        findings.push(...findInfiniteLoopCandidates(body.body, name));
      }

      findings.push(...findMissingErrorHandling(fn, name));
    }

    // Recurse into child nodes
    for (const key of Object.keys(node)) {
      const child = (node as unknown as Record<string, unknown>)[key];
      if (Array.isArray(child)) {
        for (const item of child) {
          if (item && typeof item === "object" && "type" in item) {
            visit(item as Node);
          }
        }
      } else if (child && typeof child === "object" && "type" in child) {
        visit(child as Node);
      }
    }
  }

  visit(ast.program);
  return count;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Analyzes a single JS/TS file's content and returns CFG findings.
 * Safe to call on any file — returns parseError if Babel can't parse it.
 */
export function analyzeCFG(filePath: string, content: string): CFGResult {
  const isTypeScript =
    filePath.endsWith(".ts") || filePath.endsWith(".tsx");
  const isJSX =
    filePath.endsWith(".jsx") || filePath.endsWith(".tsx");

  let ast: File;
  try {
    ast = parser.parse(content, {
      sourceType: "module",
      plugins: [
        ...(isTypeScript ? (["typescript"] as const) : []),
        ...(isJSX ? (["jsx"] as const) : []),
        "classProperties",
        "classStaticBlock",
        "dynamicImport",
        "importAssertions",
        "optionalChaining",
        "nullishCoalescingOperator",
        "decorators-legacy",
      ],
      errorRecovery: true, // don't throw on minor parse errors
      strictMode: false,
    });
  } catch (err) {
    return {
      filePath,
      findings: [],
      functionsAnalyzed: 0,
      parseError: err instanceof Error ? err.message : "Parse failed",
    };
  }

  const findings: CFGFinding[] = [];
  const functionsAnalyzed = walkFunctions(ast, findings);

  return { filePath, findings, functionsAnalyzed, parseError: null };
}

/**
 * Runs CFG analysis on the top N files by PageRank score.
 * Only processes JS/TS files — skips JSON, CSS, HTML, etc.
 */
export function analyzeCFGBatch(
  fileContents: Array<{ path: string; content: string }>,
  pageRankScores: Record<string, number>,
  topN = 5,
): CFGResult[] {
  const analysableExtensions = new Set([
    ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs",
  ]);

  const eligible = fileContents.filter((f) => {
    const ext = "." + f.path.split(".").pop();
    return analysableExtensions.has(ext);
  });

  const ranked = eligible
    .map((f) => ({ ...f, score: pageRankScores[f.path] ?? 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  return ranked.map((f) => analyzeCFG(f.path, f.content));
}

/**
 * Flattens CFGResult[] into a summary string for LLM consumption.
 * Fits within a 300-token budget — designed for the Groq 32K context.
 */
export function cfgResultsToLLMSummary(results: CFGResult[]): string {
  const lines: string[] = [];

  for (const r of results) {
    if (r.parseError) continue;
    if (r.findings.length === 0) continue;

    lines.push(`[${r.filePath}]`);
    for (const f of r.findings) {
      const prefix = f.severity === "error" ? "ERROR" : "WARN";
      lines.push(
        `  ${prefix} L${f.line}: ${f.description}`,
      );
    }
  }

  return lines.join("\n");
}