import { resolveImportAlias, extractAliasesFromTsConfig } from "./resolve-aliases";
import { TraversalNode } from "./debug/types";

export interface DependencyGraph {
  [file: string]: string[];
}

interface TraversalConfig {
  maxDepth: number;
  maxNodes: number;
  prioritizeUpstream: boolean;
}

export interface BlastRadiusResult {
  targetFile: string;
  affectedDownstream: string[];
  riskScore: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

function extractHtmlDependencies(content: string): string[] {
  const deps: string[] = [];
  const scriptRegex = /<script[^>]*src=["']([^"']+)["']/g;
  const cssRegex = /<link\s+[^>]*href=["']([^"']+)["']/g;
  let match;

  while ((match = scriptRegex.exec(content)) !== null) {
    const filePath = match[1];
    if (
      !filePath.startsWith("http") &&
      !filePath.startsWith("//") &&
      !filePath.startsWith("mailto:") &&
      !filePath.startsWith("tel:") &&
      !filePath.startsWith("#")
    ) {
      deps.push(filePath);
    }
  }

  while ((match = cssRegex.exec(content)) !== null) {
    const filePath = match[1];
    if (
      !filePath.startsWith("http") &&
      !filePath.startsWith("//") &&
      !filePath.startsWith("mailto:") &&
      !filePath.startsWith("tel:") &&
      !filePath.startsWith("#")
    ) {
      deps.push(filePath);
    }
  }

  return deps;
}

function resolveImport(importPath: string, dir: string): string {
  const parts = (dir ? dir + "/" + importPath : importPath).split("/");
  const resolved: string[] = [];

  for (const part of parts) {
    if (part === "..") resolved.pop();
    else if (part !== ".") resolved.push(part);
  }

  return resolved.join("/");
}

function extractImports(content: string, currentFile: string, aliases: Record<string, string[]>): string[] {
  const imports: string[] = [];
  const dir = currentFile.split("/").slice(0, -1).join("/");

  const es6Regex = /(?:import|export)\s+(?:[\w*{},\s]+\s+from\s+)?['"`]([^'"`]+)['"`]/g;
  const cjsRegex = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;

  let match;

  while ((match = es6Regex.exec(content)) !== null) {
    const importPath = match[1];
    
    if (importPath.startsWith(".")) {
      imports.push(resolveImport(importPath, dir));
    } else if (importPath.startsWith("@/") || importPath.startsWith("~/")) {
      imports.push(resolveImportAlias(importPath, aliases));
    } else if (!importPath.includes("/")) {
      continue;
    } else {
      imports.push(importPath);
    }
  }

  while ((match = cjsRegex.exec(content)) !== null) {
    const importPath = match[1];
    
    if (importPath.startsWith(".")) {
      imports.push(resolveImport(importPath, dir));
    } else if (importPath.startsWith("@/") || importPath.startsWith("~/")) {
      imports.push(resolveImportAlias(importPath, aliases));
    }
  }

  return imports;
}

function resolveToActualFile(importPath: string, allFiles: string[]): string | null {
  const extensions = [".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs", ".css", ".html"];
  const possibleBasePaths = [importPath, `src/${importPath}`];

  for (const basePath of possibleBasePaths) {
    if (allFiles.includes(basePath)) return basePath;

    for (const ext of extensions) {
      if (allFiles.includes(basePath + ext)) return basePath + ext;
    }

    for (const ext of extensions) {
      const indexPath = basePath + "/index" + ext;
      if (allFiles.includes(indexPath)) return indexPath;
    }
  }

  return null;
}

export function injectNextJsHeuristics(graph: DependencyGraph, allFiles: string[]): DependencyGraph {
  const enhancedGraph: DependencyGraph = JSON.parse(JSON.stringify(graph));
  const directories: Record<string, string[]> = {};
  
  for (const file of allFiles) {
    const dir = file.split("/").slice(0, -1).join("/") || "root";
    if (!directories[dir]) directories[dir] = [];
    directories[dir].push(file);
  }

  // FIXED: Changed to Object.values and removed 'dir'
  for (const filesInDir of Object.values(directories)) {
    const layout = filesInDir.find(f => f.match(/\/layout\.(tsx|ts|jsx|js)$/));
    const page = filesInDir.find(f => f.match(/\/page\.(tsx|ts|jsx|js)$/));
    const loading = filesInDir.find(f => f.match(/\/loading\.(tsx|ts|jsx|js)$/));
    const error = filesInDir.find(f => f.match(/\/error\.(tsx|ts|jsx|js)$/));

    if (page) {
      if (!enhancedGraph[page]) enhancedGraph[page] = [];
      
      if (layout && !enhancedGraph[page].includes(layout)) {
        enhancedGraph[page].push(layout);
      }
      if (loading && !enhancedGraph[page].includes(loading)) {
        enhancedGraph[page].push(loading);
      }
      if (error && !enhancedGraph[page].includes(error)) {
        enhancedGraph[page].push(error);
      }
    }
  }

  return enhancedGraph;
}

export function buildDependencyGraph(
  fileContents: { path: string; content: string }[],
  allFiles: string[]
): DependencyGraph {
  const graph: DependencyGraph = {};
  
  const tsConfigFile = fileContents.find(f => f.path === "tsconfig.json");
  const aliases = tsConfigFile ? extractAliasesFromTsConfig(tsConfigFile.content) : {};

  for (const file of fileContents) {
    let imports: string[] = [];

    if (file.path.endsWith(".html") || file.path.endsWith(".htm")) {
      imports = extractHtmlDependencies(file.content);
    } else {
      imports = extractImports(file.content, file.path, aliases);
    }

    const resolved = imports
      .map((imp) => resolveToActualFile(imp, allFiles))
      .filter((imp): imp is string => imp !== null);

    graph[file.path] = [...new Set(resolved)];
  }

  return injectNextJsHeuristics(graph, allFiles);
}

export function computeFanIn(graph: DependencyGraph): Record<string, number> {
  const fanIn: Record<string, number> = {};

  for (const imports of Object.values(graph)) {
    for (const imp of imports) {
      fanIn[imp] = (fanIn[imp] || 0) + 1;
    }
  }

  return fanIn;
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}

export function graphToMermaid(graph: DependencyGraph, entryPoints: string[]): string {
  const lines: string[] = ["graph TD"];
  const seen = new Set<string>();
  const queue = [...entryPoints];
  const fanIn = computeFanIn(graph);
  let nodes = 0;

  if (entryPoints.length === 0) {
    const potentialEntries = Object.keys(graph).filter(file => {
      const isEntry = file.includes("index.") || file.includes("main.") || file.includes("page.") || file.includes("app.");
      const isHighFanIn = (fanIn[file] || 0) > 2;
      return isEntry || isHighFanIn;  
    });
    queue.push(...potentialEntries.slice(0, 3));
  }

  if (queue.length > 0) {
    lines.push("subgraph Entry");
    queue.forEach((entry) => {
      const id = sanitize(entry);
      const name = entry.split("/").pop() || entry;
      lines.push(`  ${id}["${name}"]`);
    });
    lines.push("end");
  }

  while (queue.length > 0 && nodes < 30) {
    const current = queue.shift();
    if (!current) continue;
    if (seen.has(current)) continue;
    seen.add(current);

    const deps = graph[current] || [];

    for (const dep of deps.slice(0, 5)) {
      const fromId = sanitize(current);
      const toId = sanitize(dep);

      lines.push(`  ${fromId} --> ${toId}`);

      queue.push(dep);
    }

    nodes++;
  }

  if (lines.length === 2) {
    lines.push(`  A["No dependency relationships detected"]`);
  }

  return lines.join("\n");
}

export function getBlastRadiusTargets(fanIn: Record<string, number>, limit: number = 3): { file: string; dependentsCount: number }[] {
  return Object.entries(fanIn)
    .sort(([, countA], [, countB]) => countB - countA)
    .slice(0, limit)
    .map(([file, dependentsCount]) => ({
      file,
      dependentsCount,
    }));
}

function buildReverseGraph(graph: DependencyGraph): DependencyGraph {
  const reverse: DependencyGraph = {};

  for (const [file, imports] of Object.entries(graph)) {
    for (const imp of imports) {
      if (!reverse[imp]) reverse[imp] = [];
      reverse[imp].push(file);
    }
  }

  return reverse;
}

function bfsTraversal(
  startNode: string,
  graph: DependencyGraph,
  fanIn: Record<string, number>,
  maxDepth: number,
  relationship: "upstream" | "downstream",
  visited: Set<string>
): TraversalNode[] {
  const queue: { node: string; depth: number }[] = [
    { node: startNode, depth: 0 },
  ];
  const result: TraversalNode[] = [];

  while (queue.length > 0) {
    const { node, depth } = queue.shift()!;

    if (depth >= maxDepth) continue;

    const neighbors = graph[node] || [];

    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);

      const distance = depth + 1;
      const fanInScore = fanIn[neighbor] || 0;

      const relevance_score = (maxDepth - distance) * (1 + Math.log(fanInScore + 1));

      result.push({
        file: neighbor,
        distance,
        fan_in: fanInScore,
        relationship,
        relevance_score,
      });

      queue.push({ node: neighbor, depth: distance });
    }
  }

  return result;
}

export function traverseFromCrash(
  crashNode: string,
  graph: DependencyGraph,
  fanIn: Record<string, number>,
  config: TraversalConfig = {
    maxDepth: 3,
    maxNodes: 15,
    prioritizeUpstream: true,
  }
): TraversalNode[] {
  const result: TraversalNode[] = [];
  const visited = new Set<string>();

  result.push({
    file: crashNode,
    distance: 0,
    fan_in: fanIn[crashNode] || 0,
    relationship: "crash_site",
    relevance_score: 1000, 
  });
  visited.add(crashNode);

  const downstreamNodes = bfsTraversal(
    crashNode,
    graph,
    fanIn,
    config.maxDepth,
    "downstream",
    visited
  );

  const upstreamNodes = bfsTraversal(
    crashNode,
    buildReverseGraph(graph),
    fanIn,
    config.maxDepth,
    "upstream",
    visited
  );

  result.push(...downstreamNodes, ...upstreamNodes);
  result.sort((a, b) => b.relevance_score - a.relevance_score);

  return result.slice(0, config.maxNodes);
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