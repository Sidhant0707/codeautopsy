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

  const es6Regex = /import\s+(?:[\w*{},\s]+\s+from\s+)?['"`](\.[^'"`]+)['"`]/g;
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

    const dir = file.path.split("/").slice(0, -1).join("/");
    imports = imports.map(path => resolveImport(path, dir));

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
  let nodes = 0;

  while (queue.length > 0 && nodes < 25) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);

    const deps = graph[current] || [];
    for (const dep of deps.slice(0, 5)) {
      const from = current.split("/").pop() || current;
      const to = dep.split("/").pop() || dep;
      
      const fromId = sanitize(current);
      const toId = sanitize(dep);
      
      lines.push(`  ${fromId}["${from}"] --> ${toId}["${to}"]`);
      queue.push(dep);
    }

    nodes++;
  }

  if (lines.length === 1) {
    if (entryPoints.length > 0) {
      for (const entry of entryPoints.slice(0, 3)) {
        const name = entry.split("/").pop() || entry;
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