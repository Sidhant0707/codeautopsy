

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