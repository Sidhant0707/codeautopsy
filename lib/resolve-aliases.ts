export function extractAliasesFromTsConfig(tsconfigContent: string): Record<string, string[]> {
  try {
    // tsconfig files often have comments, which breaks standard JSON.parse
    // This regex strips out // and /* */ comments before parsing
    const cleanContent = tsconfigContent.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    const parsed = JSON.parse(cleanContent);
    return parsed.compilerOptions?.paths || {};
  } catch {
    console.warn("Failed to parse tsconfig.json content for aliases");
    return {};
  }
}

export function resolveImportAlias(
  rawImportPath: string,
  aliases: Record<string, string[]>
): string {
  if (rawImportPath.startsWith('.') || rawImportPath.startsWith('..')) {
    return rawImportPath;
  }

  for (const [aliasPattern, mappedPaths] of Object.entries(aliases)) {
    const cleanAlias = aliasPattern.replace('/*', ''); 
    
    if (rawImportPath.startsWith(cleanAlias)) {
      const cleanMappedPath = mappedPaths[0].replace('/*', ''); 
      let resolvedPath = rawImportPath.replace(cleanAlias, cleanMappedPath);
      
      // Clean up leading ./ so it matches GitHub's flat file paths (e.g., "src/components")
      if (resolvedPath.startsWith('./')) {
        resolvedPath = resolvedPath.substring(2);
      }
      return resolvedPath;
    }
  }

  return rawImportPath;
}