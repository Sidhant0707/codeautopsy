export interface DependencyGraph {
  [file: string]: string[];
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

function extractImports(content: string, currentFile: string): string[] {
  const imports: string[] = [];
  const dir = currentFile.split("/").slice(0, -1).join("/");

  // ES6 imports - NOW SUPPORTS PATH ALIASES
  const es6Regex = /import\s+(?:[\w*{},\s]+\s+from\s+)?['"`]([^'"`]+)['"`]/g;
  const cjsRegex = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;

  let match;

  while ((match = es6Regex.exec(content)) !== null) {
    const importPath = match[1];
    
    // Handle relative imports
    if (importPath.startsWith(".")) {
      imports.push(resolveImport(importPath, dir));
    }
    // Handle path aliases (@/, ~/, etc.)
    else if (importPath.startsWith("@/")) {
      imports.push(importPath.replace("@/", ""));
    }
    else if (importPath.startsWith("~/")) {
      imports.push(importPath.replace("~/", ""));
    }
    // Skip node_modules
    else if (!importPath.includes("/")) {
      continue;
    }
  }

  while ((match = cjsRegex.exec(content)) !== null) {
    const importPath = match[1];
    
    if (importPath.startsWith(".")) {
      imports.push(resolveImport(importPath, dir));
    }
    else if (importPath.startsWith("@/")) {
      imports.push(importPath.replace("@/", ""));
    }
    else if (importPath.startsWith("~/")) {
      imports.push(importPath.replace("~/", ""));
    }
  }

  return imports;
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

function resolveToActualFile(
  importPath: string,
  allFiles: string[]
): string | null {
  const extensions = [".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs", ".py", ".go", ".css", ".html"];

  if (allFiles.includes(importPath)) return importPath;

  for (const ext of extensions) {
    if (allFiles.includes(importPath + ext)) return importPath + ext;
  }

  for (const ext of extensions) {
    const indexPath = importPath + "/index" + ext;
    if (allFiles.includes(indexPath)) return indexPath;
  }

  return null;
}

export function buildDependencyGraph(
  fileContents: { path: string; content: string }[],
  allFiles: string[]
): DependencyGraph {
  const graph: DependencyGraph = {};

  for (const file of fileContents) {
    let imports: string[] = [];

    if (file.path.endsWith(".html") || file.path.endsWith(".htm")) {
      imports = extractHtmlDependencies(file.content);
    } else {
      imports = extractImports(file.content, file.path);
    }

    const resolved = imports
      .map((imp) => resolveToActualFile(imp, allFiles))
      .filter((imp): imp is string => imp !== null);

    graph[file.path] = [...new Set(resolved)];
  }

  return graph;
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

export function graphToMermaid(
  graph: DependencyGraph,
  entryPoints: string[]
): string {
  const lines: string[] = ["graph TD"];
  const seen = new Set<string>();
  const queue = [...entryPoints];
  const fanIn = computeFanIn(graph);
  let nodes = 0;

  // IMPROVED: Auto-detect entry points if none provided
  if (entryPoints.length === 0) {
  const potentialEntries = Object.keys(graph).filter(file => {
    const isEntry = file.includes("index.") || file.includes("main.") || file.includes("page.") || file.includes("app.");
    const isHighFanIn = (fanIn[file] || 0) > 2;
    return isEntry || isHighFanIn;  // Removed hasNoDeps
  });
  queue.push(...potentialEntries.slice(0, 3));
}

  // ENTRY SUBGRAPH
  if (queue.length > 0) {
    lines.push("subgraph Entry");
    queue.forEach((entry) => {
      const id = sanitize(entry);
      const name = entry.split("/").pop() || entry;
      lines.push(`  ${id}["${name}"]`);
    });
    lines.push("end");
  }

  // DEPENDENCY GRAPH
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

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}