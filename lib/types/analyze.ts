import type { CFGResult } from "@/lib/cfg-builder";

export interface Analysis {
  architecture_pattern: string;
  what_it_does: string;
  execution_flow: string[];
  tech_stack: { name: string; purpose: string }[];
  key_modules: { file: string; role: string; why_it_exists: string }[];
  onboarding_guide: string[];
  blast_radius: {
    file: string;
    dependents: number;
    warning: string;
    safe_refactor_steps: string[];
  }[];
  health_status?: {
    grade: string;
    score: number;
    status: string;
    refactor_plan: string[];
  };
}

export interface RepoData {
  owner: string;
  repo: string;
  description: string;
  stars: number;
  language: string;
  totalFiles: number;
  entryPoints: string[];
  mermaidDiagram: string;
  analysis: Analysis;
  dependencyGraph?: Record<string, string[]>;
  fileMetrics: { path: string; size: number }[];
  coverageGaps?: {
    file: string;
    fanIn: number;
    riskScore: number;
    isTested: boolean;
    testFiles: string[];
  }[];
  fileContents?: { path: string; content: string }[];
  pageRankScores?: Record<string, number>;
  betweennessScores?: Record<string, number>;
  cfgFindings?: CFGResult[];
  cfgSummary?: string;
  articulationPoints?: string[];
  bridges?: Array<[string, string]>;
  componentSizes?: Record<string, number>;
}

export interface PRBlastRadiusItem {
  file: string;
  impact: string;
}

export interface PRAnalysisResult {
  prNumber: number;
  title: string;
  description: string;
  blastRadius: PRBlastRadiusItem[];
  architecturalChanges: string[];
  breakingDependencies: string[];
  riskLevel: "low" | "medium" | "high";
  suggestedReviewers?: { username: string; reason: string }[];
  changedFiles?: string[];
}

export interface BlastRadiusResult {
  targetFile: string;
  affectedDownstream: string[];
  riskScore: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export function calculateBlastRadius(
  modifiedFiles: string[],
  reverseDependencyGraph: Record<string, string[]>
): BlastRadiusResult[] {
  const results: BlastRadiusResult[] = [];

  for (const file of modifiedFiles) {
    const affected = new Set<string>();
    const queue = [file];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const dependents = reverseDependencyGraph[current] || [];

      for (const dep of dependents) {
        if (!affected.has(dep)) {
          affected.add(dep);
          queue.push(dep);
        }
      }
    }

    const affectedArray = Array.from(affected);
    let risk: BlastRadiusResult["riskScore"] = "LOW";

    if (affectedArray.length > 20) risk = "CRITICAL";
    else if (affectedArray.length > 10) risk = "HIGH";
    else if (affectedArray.length > 3) risk = "MEDIUM";

    results.push({
      targetFile: file,
      affectedDownstream: affectedArray,
      riskScore: risk,
    });
  }

  return results.sort((a, b) => b.affectedDownstream.length - a.affectedDownstream.length);
}