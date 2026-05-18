import { z } from "zod";

// 1. Define the nested schemas first
export const HealthStatusSchema = z.object({
  grade: z.enum(["A", "B", "C", "D", "F"]), // Strict literal enforcement
  score: z.number(),
  status: z.string(),
  refactor_plan: z.array(z.string()),
});

export const AnalysisSchema = z.object({
  architecture_pattern: z.string(),
  what_it_does: z.string(),
  execution_flow: z.array(z.string()),
  tech_stack: z.array(z.object({ name: z.string(), purpose: z.string() })),
  key_modules: z.array(
    z.object({ file: z.string(), role: z.string(), why_it_exists: z.string() })
  ),
  onboarding_guide: z.array(z.string()),
  blast_radius: z.array(
    z.object({
      file: z.string(),
      dependents: z.number(),
      warning: z.string(),
      safe_refactor_steps: z.array(z.string()),
    })
  ),
  health_status: HealthStatusSchema.optional(),
});

// 2. Export the Master Schema
export const RepoDataSchema = z.object({
  owner: z.string(),
  repo: z.string(),
  description: z.string(),
  stars: z.number(),
  language: z.string(),
  totalFiles: z.number(),
  entryPoints: z.array(z.string()),
  mermaidDiagram: z.string(),
  analysis: AnalysisSchema,
  dependencyGraph: z.record(z.string(), z.array(z.string())).optional(),
  fileMetrics: z.array(z.object({ path: z.string(), size: z.number() })),
  coverageGaps: z.array(
    z.object({
      file: z.string(),
      fanIn: z.number(),
      riskScore: z.number(),
      isTested: z.boolean(),
      testFiles: z.array(z.string()),
    })
  ).optional(),
  fileContents: z.array(
    z.object({ path: z.string(), content: z.string() })
  ).optional(),
});

export type ValidatedRepoData = z.infer<typeof RepoDataSchema>;