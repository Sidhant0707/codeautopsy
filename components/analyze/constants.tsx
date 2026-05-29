import {
  FileCode,
  Layers,
  Activity,
  GitPullRequest,
  Target,
  Cpu,
} from "lucide-react";

// ─── Framer Motion ────────────────────────────────────────────────────────────

export const EXPO_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

// ─── Tab Configuration ────────────────────────────────────────────────────────

export const TAB_CONFIG = [
  { id: "overview" as const, icon: FileCode, label: "Read Docs" },
  { id: "visualizer" as const, icon: Layers, label: "Blueprint Map" },
  { id: "doctor" as const, icon: Activity, label: "Diagnostic Engine" },
  { id: "pr_impact" as const, icon: GitPullRequest, label: "PR Impact" },
  { id: "risk_radar" as const, icon: Target, label: "Risk Radar" },
  { id: "arch_insights" as const, icon: Cpu, label: "Arch Insights" },
] as const;

export type TabType = (typeof TAB_CONFIG)[number]["id"];

// ─── Map View Configuration ───────────────────────────────────────────────────

export const MAP_VIEW_CONFIG = [
  { id: "graph" as const, label: "Dependency Flow" },
  { id: "directory" as const, label: "Folder Structure" },
  { id: "treemap" as const, label: "Codebase Weight" },
] as const;

export type MapViewType = (typeof MAP_VIEW_CONFIG)[number]["id"];

// ─── Loading Screen Phrases ───────────────────────────────────────────────────

export const LOADING_PHRASES = [
  "Cloning repository...",
  "Decrypting source tree...",
  "Mapping AST nodes...",
  "Tracing execution flows...",
  "Calculating blast radius...",
  "Evaluating test coverage...",
  "Querying Groq LLM...",
  "Compiling health report...",
] as const;

// ─── Default Analysis Skeleton ────────────────────────────────────────────────
// Shown in the UI while the AI stream is starting up.
// Intentionally does NOT satisfy the full Analysis interface — the streaming
// engine progressively replaces these placeholder values.

export const DEFAULT_ANALYSIS = {
  architecture_pattern: "Analyzing...",
  what_it_does: "Waking up Groq LLM...",
  execution_flow: [],
  tech_stack: [],
  key_modules: [],
  onboarding_guide: [],
  evidence_paths: [],
  blast_radius: [],
  health_status: {
    grade: "-",
    score: 0,
    status: "Pending",
    refactor_plan: [],
  },
} as const;
