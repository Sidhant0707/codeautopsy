// lib/analyzer/blast-radius.ts

export interface BlastRadiusResult {
  targetFile: string;
  affectedDownstream: string[];
  riskScore: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

/**
 * Calculates the "Blast Radius" of modified files against the repository's dependency graph.
 * 
 * @param modifiedFiles - Array of filenames changed in the PR (from pr-fetcher)
 * @param reverseDependencyGraph - Record where Key = File, Value = Array of files that IMPORT the key.
 */
export function calculateBlastRadius(
  modifiedFiles: string[],
  reverseDependencyGraph: Record<string, string[]>
): BlastRadiusResult[] {
  const results: BlastRadiusResult[] = [];

  for (const file of modifiedFiles) {
    const affected = new Set<string>();
    
    // Breadth-First Search (BFS) to find all downstream cascading effects
    const queue = [file];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      
      // Look up what files depend on the current file
      const dependents = reverseDependencyGraph[current] || [];
      
      for (const dep of dependents) {
        if (!affected.has(dep)) {
          affected.add(dep);
          queue.push(dep); // Add to queue to find what depends on the dependent
        }
      }
    }

    const affectedArray = Array.from(affected);
    let risk: BlastRadiusResult["riskScore"] = "LOW";
    
    // Assign a risk tier based on how many files this change cascades to
    if (affectedArray.length > 20) risk = "CRITICAL";
    else if (affectedArray.length > 10) risk = "HIGH";
    else if (affectedArray.length > 3) risk = "MEDIUM";

    results.push({
      targetFile: file,
      affectedDownstream: affectedArray,
      riskScore: risk,
    });
  }

  // Sort by highest risk first
  return results.sort((a, b) => b.affectedDownstream.length - a.affectedDownstream.length);
}