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
  // ── Added: raw list of files changed in the PR, used by ArchitectureMap
  // for the client-side multi-source reverse BFS (pr-blast mode).
  // Populated by /api/analyze-pr from the GitHub /pulls/{pr}/files endpoint.
  changedFiles?: string[];
}