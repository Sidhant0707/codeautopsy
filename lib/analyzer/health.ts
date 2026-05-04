// lib/analyzer/health.ts

export interface CodebaseMetrics {
  totalFiles: number;
  circularDependencies: number; // Count of dependency loops
  maxFanIn: number;             // The highest number of dependents a single file has
  largeFilesCount: number;      // Files over ~500 lines or a certain KB limit
}

export function calculateHealthGrade(metrics: CodebaseMetrics) {
  let score = 100;

  // 1. Circular Dependency Penalty (Severe)
  // Dependency loops cause infinite renders and spaghetti code. -15 points per loop.
  score -= (metrics.circularDependencies * 15);

  // 2. Coupling Penalty (The "God Module" factor)
  // A normal file has 1-5 dependents. If a file has 15+ dependents, it's a bottleneck.
  const SAFE_FAN_IN_THRESHOLD = 10;
  if (metrics.maxFanIn > SAFE_FAN_IN_THRESHOLD) {
    // -2 points for every connection above the safe threshold (capped at -30)
    const couplingPenalty = Math.min(30, (metrics.maxFanIn - SAFE_FAN_IN_THRESHOLD) * 2);
    score -= couplingPenalty;
  }

  // 3. Bloat Penalty (The "Monolith" factor)
  // If a large percentage of the codebase consists of massive files, penalize it.
  const largeFileRatio = metrics.largeFilesCount / Math.max(1, metrics.totalFiles);
  score -= (largeFileRatio * 40); // E.g., if 25% of files are huge, drop score by 10

  // Ensure score stays cleanly within 0-100 bounds
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Assign the Grade and Color for the UI
  let grade = "F";
  let color = "red-500";
  let status = "Critical Tech Debt";

  if (score >= 90) { 
    grade = "A"; 
    color = "emerald-500"; 
    status = "Pristine Architecture";
  } else if (score >= 80) { 
    grade = "B"; 
    color = "blue-500"; 
    status = "Solid Foundation";
  } else if (score >= 70) { 
    grade = "C"; 
    color = "amber-500"; 
    status = "Moderate Coupling";
  } else if (score >= 60) { 
    grade = "D"; 
    color = "orange-500"; 
    status = "High Refactor Risk";
  }

  return { score, grade, color, status };
}