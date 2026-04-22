// lib/debug/types.ts

export interface CrashNode {
  file: string;
  line: number;
  column?: number;
  function?: string;
}

export interface TraversalNode {
  file: string;
  distance: number;
  fan_in: number;
  relationship: "upstream" | "downstream" | "crash_site";
  relevance_score: number;
}

export interface DebugContext {
  error_type: string;
  error_message: string;
  crash_location: CrashNode;
  traversal_path: TraversalNode[];
  relevant_code: {
    file: string;
    content: string;
    is_crash_site: boolean;
    line_context?: { start: number; end: number };
  }[];
  repo_context: {
    repo_name: string;
    entry_points: string[];
    tech_stack: { name: string; purpose: string }[];
  };
}

export interface DebugResult {
  root_cause_hypothesis: string;
  fix_suggestions: string[];
  verification_steps: string[];
  confidence: "high" | "medium" | "low";
  requires_runtime_check: boolean;
}

export interface DebugAnalysis {
  debug_id: string;
  crash_node: CrashNode;
  traversal_path: TraversalNode[];
  root_cause_hypothesis: string;
  fix_suggestions: string[];
  verification_steps: string[];
  confidence: "high" | "medium" | "low";
  requires_runtime_check: boolean;
  highlighted_mermaid: string;
}