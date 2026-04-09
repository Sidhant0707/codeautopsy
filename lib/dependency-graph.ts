export interface DependencyGraph {
  [file: string]: string[];
}

// Extract local imports from a file's content
function extractImports(content: string, currentFile: string): string[] {
  const imports: string[] = [];
  const dir = currentFile.split("/").slice(0, -1).join("/");

  // Match ES6 imports: import x from "./something"
  const es6Regex = /import\s+(?:[\w*{},\s]+\s+from\s+)?['"`](\.[^'"`]+)['"`]/g;
  // Match CommonJS: require("./something")
  const cjsRegex = /require\s*\(\s*['"`](\.[^'"`]+)['"`]\s*\)/g;

  let match;

  while ((match = es6Regex.exec(content)) !== null) {
    imports.push(resolveImport(match[1], dir));
  }

  while ((match = cjsRegex.exec(content)) !== null) {
    imports.push(resolveImport(match[1], dir));
  }

  return imports;
}

// Resolve relative import path to absolute
function resolveImport(importPath: string, dir: string): string {
  const parts = (dir ? dir + "/" + importPath : importPath).split("/");
  const resolved: string[] = [];

  for (const part of parts) {
    if (part === "..") resolved.pop();
    else if (part !== ".") resolved.push(part);
  }

  return resolved.join("/");
}

// Try to match an import path to an actual file in the repo
function resolveToActualFile(
  importPath: string,
  allFiles: string[]
): string | null {
  const extensions = [".js", ".ts", ".jsx", ".tsx", ".py", ".go"];

  // Exact match
  if (allFiles.includes(importPath)) return importPath;

  // Try adding extensions
  for (const ext of extensions) {
    if (allFiles.includes(importPath + ext)) return importPath + ext;
  }

  // Try index files
  for (const ext of extensions) {
    const indexPath = importPath + "/index" + ext;
    if (allFiles.includes(indexPath)) return indexPath;
  }

  return null;
}

// Build the full dependency graph from file contents
export function buildDependencyGraph(
  fileContents: { path: string; content: string }[],
  allFiles: string[]
): DependencyGraph {
  const graph: DependencyGraph = {};

  for (const file of fileContents) {
    const imports = extractImports(file.content, file.path);
    const resolved = imports
      .map((imp) => resolveToActualFile(imp, allFiles))
      .filter((imp): imp is string => imp !== null);

    graph[file.path] = [...new Set(resolved)]; // deduplicate
  }

  return graph;
}

// Compute how many files import each file (fan-in = importance)
export function computeFanIn(graph: DependencyGraph): Record<string, number> {
  const fanIn: Record<string, number> = {};

  for (const imports of Object.values(graph)) {
    for (const imp of imports) {
      fanIn[imp] = (fanIn[imp] || 0) + 1;
    }
  }

  return fanIn;
}

// Convert graph to Mermaid diagram string
export function graphToMermaid(
  graph: DependencyGraph,
  entryPoints: string[]
): string {
  const lines: string[] = ["graph TD"];
  const seen = new Set<string>();
  const queue = [...entryPoints];
  let depth = 0;

  while (queue.length > 0 && depth < 3) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);

    const deps = graph[current] || [];
    for (const dep of deps.slice(0, 5)) {
      const from = current.split("/").pop()?.replace(/\.[^.]+$/, "") || current;
      const to = dep.split("/").pop()?.replace(/\.[^.]+$/, "") || dep;
      
      const fromId = sanitize(current);
      const toId = sanitize(dep);
      
      lines.push(`  ${fromId}["${from}"] --> ${toId}["${to}"]`);
      queue.push(dep);
    }

    depth++;
  }

  if (lines.length === 1) {
    if (entryPoints.length > 0) {
      for (const entry of entryPoints.slice(0, 3)) {
        const name = entry.split("/").pop()?.replace(/\.[^.]+$/, "") || entry;
        const id = sanitize(entry);
        lines.push(`  ${id}["${name}"]`);
      }
    } else {
      lines.push(`  Project["No clear entry points detected"]`);
    }
  }

  return lines.join("\n");
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}