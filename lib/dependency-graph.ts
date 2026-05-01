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

  // FIX: Added support for `export ... from '...'` syntax
  const es6Regex = /(?:import|export)\s+(?:[\w*{},\s]+\s+from\s+)?['"`]([^'"`]+)['"`]/g;
  const cjsRegex = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;

  let match;

  while ((match = es6Regex.exec(content)) !== null) {
    const importPath = match[1];
    
    if (importPath.startsWith(".")) {
      imports.push(resolveImport(importPath, dir));
    } else if (importPath.startsWith("@/")) {
      imports.push(importPath.replace("@/", ""));
    } else if (importPath.startsWith("~/")) {
      imports.push(importPath.replace("~/", ""));
    } else if (!importPath.includes("/")) {
      continue;
    } else {
      // Catch scoped packages or standard full paths
      imports.push(importPath);
    }
  }

  while ((match = cjsRegex.exec(content)) !== null) {
    const importPath = match[1];
    
    if (importPath.startsWith(".")) {
      imports.push(resolveImport(importPath, dir));
    } else if (importPath.startsWith("@/")) {
      imports.push(importPath.replace("@/", ""));
    } else if (importPath.startsWith("~/")) {
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
  const extensions = [".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs", ".css", ".html"];

  // FIX: Check standard path AND the "src/" fallback for Next.js aliases
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

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}

// ==========================================
// SPRINT 2: NEW BLAST RADIUS FUNCTION
// ==========================================
export function getBlastRadiusTargets(fanIn: Record<string, number>, limit: number = 3): { file: string; dependentsCount: number }[] {
  return Object.entries(fanIn)
    .sort(([, countA], [, countB]) => countB - countA)
    .slice(0, limit)
    .map(([file, dependentsCount]) => ({
      file,
      dependentsCount,
    }));
}