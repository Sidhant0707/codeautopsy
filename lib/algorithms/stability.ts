// lib/algorithms/stability.ts

export interface FileStability {
  path: string;
  afferent: number;   // Ca: how many files import this file
  efferent: number;   // Ce: how many files this file imports
  instability: number; // I = Ce / (Ca + Ce), range [0, 1]
  label: string;       // "stable" | "unstable" | "balanced"
  zone: "pain" | "uselessness" | "main-sequence" | "balanced";
}

export interface StabilityResult {
  files: FileStability[];
  avgInstability: number;
  mostUnstable: FileStability[];
  mostStable: FileStability[];
}

export function computeStability(
  graph: Record<string, string[]>,
): StabilityResult {
  const nodes = Object.keys(graph);
  if (nodes.length === 0) {
    return { files: [], avgInstability: 0, mostUnstable: [], mostStable: [] };
  }

  const afferentMap = new Map<string, number>();
  const efferentMap = new Map<string, number>();

  // Initialise all known nodes
  for (const node of nodes) {
    if (!afferentMap.has(node)) afferentMap.set(node, 0);
    if (!efferentMap.has(node)) efferentMap.set(node, 0);
  }

  // Count Ce (efferent) = outgoing imports
  // Count Ca (afferent) = incoming imports
  for (const src of nodes) {
    const deps = graph[src] || [];
    efferentMap.set(src, deps.length);
    for (const dep of deps) {
      if (!afferentMap.has(dep)) afferentMap.set(dep, 0);
      if (!efferentMap.has(dep)) efferentMap.set(dep, 0);
      afferentMap.set(dep, afferentMap.get(dep)! + 1);
    }
  }

  const allNodes = Array.from(
    new Set([...afferentMap.keys(), ...efferentMap.keys()]),
  );

  const files: FileStability[] = allNodes.map((path) => {
    const ca = afferentMap.get(path) ?? 0;
    const ce = efferentMap.get(path) ?? 0;
    const total = ca + ce;
    const instability = total === 0 ? 0.5 : ce / total;

    // Martin's zones
    // Abstractness (A) we approximate as 0 (no AST) so:
    // Zone of Pain = low instability + low abstraction (I < 0.3)
    // Zone of Uselessness = high instability + high abstraction (I > 0.7, Ca ≈ 0)
    // Main sequence = balanced
    let zone: FileStability["zone"];
    if (instability < 0.3 && ce > 3) zone = "pain";
    else if (instability > 0.7 && ca === 0) zone = "uselessness";
    else if (instability >= 0.3 && instability <= 0.7) zone = "main-sequence";
    else zone = "balanced";

    const label =
      instability < 0.3 ? "stable" : instability > 0.7 ? "unstable" : "balanced";

    return { path, afferent: ca, efferent: ce, instability, label, zone };
  });

  const avgInstability =
    files.reduce((s, f) => s + f.instability, 0) / files.length;

  const sorted = [...files].sort((a, b) => b.instability - a.instability);

  return {
    files,
    avgInstability,
    mostUnstable: sorted.slice(0, 10),
    mostStable: sorted.slice(-10).reverse(),
  };
}