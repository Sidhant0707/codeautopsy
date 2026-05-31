// lib/github/resolve-aliases.ts

// ---------------------------------------------------------------------------
// CodeAutopsy - Path Alias Resolver
//
// The AST pipeline encounters import statements like:
//   import { foo } from "@/lib/utils"
//   import Bar from "~/components/Bar"
//
// Without resolving these aliases, the dependency graph has broken edges.
// This module:
//   1. Fetches tsconfig.json (jsconfig.json as fallback) from GitHub API
//   2. Parses compilerOptions.baseUrl + compilerOptions.paths
//   3. Detects Next.js and injects its implicit "@/" alias if not already set
//   4. Returns a compiled PathAliasResolver for fast lookups per import
//
// Used by: lib/pipeline/ast-pipeline.ts
// ---------------------------------------------------------------------------

// ---------- Public types ----------------------------------------------------

/**
 * Flat alias map after parsing tsconfig.
 * Key   = alias prefix WITHOUT trailing wildcard, e.g. "@/", "~/"
 * Value = resolved directory prefix,              e.g. "src/", "./"
 */
export type AliasMap = Record<string, string>;

/**
 * The compiled resolver handed to the AST pipeline.
 * Call resolve(importPath) on every import string encountered during
 * graph construction.
 *
 * @example
 *   resolver.resolve("@/lib/utils")  // "src/lib/utils"
 *   resolver.resolve("./sibling")    // "./sibling"  (unchanged)
 */
export interface PathAliasResolver {
  resolve(importPath: string): string;
  /** Raw alias map for debugging / display in the UI. */
  aliases: AliasMap;
  /** False when no tsconfig was found or it had no path aliases. */
  hasAliases: boolean;
}

// ---------- Internal types --------------------------------------------------

interface TsConfig {
  compilerOptions?: {
    baseUrl?: string;
    paths?: Record<string, string[]>;
  };
  extends?: string;
}

interface GitHubContentResponse {
  type: string;
  encoding: string;
  content: string;
}

// ---------- GitHub content fetch --------------------------------------------

/**
 * Fetches a single file's raw text from a GitHub repo via the Contents API.
 * Returns null on 404 or any non-OK response so callers can fall back cleanly.
 */
async function fetchRepoFile(
  owner: string,
  repo: string,
  path: string,
  token?: string,
  branch?: string
): Promise<string | null> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const ref = branch ? `?ref=${encodeURIComponent(branch)}` : "";
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}${ref}`;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;

    const data: GitHubContentResponse = await res.json();

    if (data.encoding === "base64" && data.content) {
      // GitHub base64-encodes file content; embedded newlines must be stripped
      const cleaned = data.content.replace(/\n/g, "");
      return Buffer.from(cleaned, "base64").toString("utf-8");
    }

    return null;
  } catch {
    return null;
  }
}

// ---------- tsconfig parsing ------------------------------------------------

/**
 * Strips // line comments and block comments from JSON-like text so that
 * tsconfig.json files (which allow comments) can be parsed with JSON.parse.
 */
function stripJsonComments(raw: string): string {
  let result = raw.replace(/\/\/[^\n]*/g, "");
  result = result.replace(/\/\*[\s\S]*?\*\//g, "");
  return result;
}

function parseTsConfig(raw: string): TsConfig | null {
  try {
    return JSON.parse(stripJsonComments(raw)) as TsConfig;
  } catch {
    return null;
  }
}

/**
 * Resolves a tsconfig "extends" value to a repo-relative file path.
 * Returns null for npm package references (e.g. "@tsconfig/node18/tsconfig.json")
 * since those cannot be fetched from the repo itself.
 */
function resolveExtendsPath(extendsValue: string): string | null {
  // npm package reference -- skip
  if (!extendsValue.startsWith(".") && !extendsValue.startsWith("/")) return null;
  return extendsValue.replace(/^\.\//, "").replace(/^\//, "");
}

/**
 * Fetches the tsconfig and follows "extends" up to 3 levels deep, returning
 * the merged compilerOptions. Child values always override parent values.
 */
async function fetchMergedTsConfig(
  owner: string,
  repo: string,
  token: string | undefined,
  branch: string | undefined,
  configPath = "tsconfig.json",
  depth = 0
): Promise<TsConfig["compilerOptions"] | null> {
  if (depth > 3) return null;

  const raw = await fetchRepoFile(owner, repo, configPath, token, branch);
  if (!raw) return null;

  const config = parseTsConfig(raw);
  if (!config) return null;

  let merged = { ...config.compilerOptions };

  if (config.extends) {
    const parentPath = resolveExtendsPath(config.extends);
    if (parentPath) {
      const parentOpts = await fetchMergedTsConfig(
        owner,
        repo,
        token,
        branch,
        parentPath,
        depth + 1
      );
      if (parentOpts) {
        // Parent is the base; child overrides on top
        merged = { ...parentOpts, ...merged };
        // Merge path maps: child entries override parent entries
        merged.paths = {
          ...(parentOpts.paths ?? {}),
          ...(config.compilerOptions?.paths ?? {}),
        };
      }
    }
  }

  return merged;
}

// ---------- Next.js detection -----------------------------------------------

/**
 * Returns true if the repo appears to be a Next.js project, detected by the
 * presence of next.config.js / next.config.ts / next.config.mjs.
 *
 * When true we inject an implicit "@/" alias that Next.js provides even when
 * it is absent from tsconfig.paths.
 */
async function detectNextJs(
  owner: string,
  repo: string,
  token?: string,
  branch?: string
): Promise<boolean> {
  const configs = ["next.config.js", "next.config.ts", "next.config.mjs"];
  for (const file of configs) {
    const content = await fetchRepoFile(owner, repo, file, token, branch);
    if (content !== null) return true;
  }
  return false;
}

// ---------- Alias extraction ------------------------------------------------

/**
 * Converts a single raw tsconfig paths entry into a prefix/target pair.
 *
 * tsconfig uses glob wildcards:
 *   "@/*"    + "src/*"    -> prefix "@/"    target "src/"
 *   "~/*"    + "./*"     -> prefix "~/"    target "./"
 *   "#utils" + "src/utils" -> prefix "#utils" target "src/utils"
 *
 * Only the first target in the array is used (standard convention).
 */
function extractAliasEntry(
  aliasPattern: string,
  targetPatterns: string[],
  baseUrl: string
): { prefix: string; target: string } | null {
  if (!targetPatterns.length) return null;

  const rawTarget = targetPatterns[0];

  const prefix = aliasPattern.endsWith("/*")
    ? aliasPattern.slice(0, -1) // "@/*" -> "@/"
    : aliasPattern.endsWith("*")
    ? aliasPattern.slice(0, -1) // "@*" -> "@"
    : aliasPattern; // exact match

  const target = rawTarget.endsWith("/*")
    ? rawTarget.slice(0, -1) // "src/*" -> "src/"
    : rawTarget.endsWith("*")
    ? rawTarget.slice(0, -1)
    : rawTarget;

  // Prepend baseUrl when target is relative to it (not starting with ./ ../ /)
  const resolvedTarget =
    target.startsWith("./") || target.startsWith("/") || target.startsWith("../")
      ? target.replace(/^\.\//, "") // strip "./" prefix
      : baseUrl
      ? `${baseUrl.replace(/\/$/, "")}/${target}`.replace(/^\.\//, "")
      : target;

  return { prefix, target: resolvedTarget };
}

// ---------- Resolver factory ------------------------------------------------

function buildResolver(aliases: AliasMap): PathAliasResolver {
  // Longest prefix first so "@/components" beats "@/" on a match
  const sorted = Object.entries(aliases).sort((a, b) => b[0].length - a[0].length);
  const hasAliases = sorted.length > 0;

  return {
    aliases,
    hasAliases,
    resolve(importPath: string): string {
      for (const [prefix, target] of sorted) {
        if (importPath === prefix || importPath.startsWith(prefix)) {
          return target + importPath.slice(prefix.length);
        }
      }
      return importPath;
    },
  };
}

// ---------- Main export -----------------------------------------------------

/**
 * Fetches the repo's TypeScript/JavaScript path configuration and returns a
 * compiled resolver the AST pipeline can call on every import it encounters.
 *
 * Resolution order:
 *   1. tsconfig.json (follows "extends" up to 3 levels)
 *   2. jsconfig.json if tsconfig is absent
 *   3. Next.js implicit "@/" alias injected when next.config.* is detected
 *
 * Always returns a valid resolver -- if no config is found it is a no-op
 * passthrough so the pipeline does not need to handle undefined.
 *
 * @example
 * ```ts
 * // In ast-pipeline.ts:
 * const resolver = await buildPathAliasResolver({ owner, repo, token, branch });
 *
 * // During AST import traversal:
 * const realPath = resolver.resolve(importNode.source.value);
 * dependencyGraph[currentFile].push(realPath);
 * ```
 */
export async function buildPathAliasResolver(options: {
  owner: string;
  repo: string;
  token?: string;
  branch?: string;
}): Promise<PathAliasResolver> {
  const { owner, repo, token, branch } = options;

  // Step 1: Fetch tsconfig.json, fall back to jsconfig.json
  const compilerOptions =
    (await fetchMergedTsConfig(owner, repo, token, branch, "tsconfig.json")) ??
    (await fetchMergedTsConfig(owner, repo, token, branch, "jsconfig.json"));

  // Step 2: Detect Next.js for implicit alias injection
  const isNextJs = await detectNextJs(owner, repo, token, branch);

  // Step 3: Build alias map from compilerOptions.paths
  const aliasMap: AliasMap = {};

  if (compilerOptions) {
    const baseUrl = compilerOptions.baseUrl
      ? compilerOptions.baseUrl.replace(/\/$/, "").replace(/^\.\//, "")
      : "";

    for (const [pattern, targets] of Object.entries(compilerOptions.paths ?? {})) {
      const entry = extractAliasEntry(pattern, targets, baseUrl);
      if (entry) {
        aliasMap[entry.prefix] = entry.target;
      }
    }
  }

  // Step 4: Inject Next.js "@/" alias if not already defined by tsconfig
  // Next.js maps "@/" to the project root by default. "src/" is used here
  // as it is the most common layout in modern Next.js projects.
  if (isNextJs && !aliasMap["@/"]) {
    aliasMap["@/"] = "src/";
  }

  return buildResolver(aliasMap);
}

// ---------- Utility ---------------------------------------------------------

/**
 * One-shot resolver for cases where you already have an AliasMap and just
 * need to resolve a single import path without building a full resolver object.
 *
 * @example
 *   resolveWithAliases("@/utils/format", { "@/": "src/" })
 *   // "src/utils/format"
 */
export function resolveWithAliases(importPath: string, aliases: AliasMap): string {
  return buildResolver(aliases).resolve(importPath);
}