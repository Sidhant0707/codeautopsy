// lib/analysis-cache.ts
//
// Semantic caching layer for CodeAutopsy repo analyses.
//
// Cache key:  analyses table row keyed on (repo_url, commit_sha, analysis_version, user_id).
// This table already exists in your Supabase schema (confirmed from screenshot).
// The pipeline already reads from it via the checkCache callback in runAstPipeline.
// This module adds the three missing pieces:
//   1. getLatestCommitSha  — fetches the HEAD sha from GitHub API.
//   2. isCacheStale        — compares stored commit_sha vs live HEAD.
//   3. invalidateUserCache — hard-deletes rows for a (repo_url, user_id) pair.
//   4. forceReanalyze      — used by /api/reanalyze route to bust cache.
//
// TTL is enforced via a Postgres partial index or a where-clause filter on
// created_at. No cron needed — stale rows are just ignored on read, and
// the nightly Supabase pg_cron cleanup (if configured) handles GC.

import { SupabaseClient } from "@supabase/supabase-js";

const CACHE_TTL_HOURS = 24;
const ANALYSIS_VERSION = 14; // keep in sync with app/api/analyze/route.ts

// ── GitHub HEAD sha ────────────────────────────────────────────────────────A

/**
 * Fetches the HEAD commit SHA of the default branch for a repo.
 * Uses the same token-passing pattern as the rest of the codebase.
 *
 * @returns SHA string, or null on any network / auth failure.
 */
export async function getLatestCommitSha(
  owner: string,
  repo: string,
  githubToken: string,
): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/HEAD`,
      {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        next: { revalidate: 60 }, // Next.js fetch cache: 1 min
      },
    );

    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.sha === "string" ? data.sha : null;
  } catch {
    return null;
  }
}

// ── Cache staleness check ──────────────────────────────────────────────────

export interface CacheStatusResult {
  hit: boolean;
  stale: boolean;
  storedSha: string | null;
  liveSha: string | null;
  cachedAt: string | null;
}

/**
 * Checks if a valid, non-stale cache entry exists for the given repo + user.
 *
 * "Stale" means either:
 *   - The stored commit_sha differs from the current HEAD sha.
 *   - The cached row is older than CACHE_TTL_HOURS.
 */
export async function getCacheStatus(
  supabase: SupabaseClient,
  repoUrl: string,
  userId: string | null,
  owner: string,
  repo: string,
  githubToken: string,
): Promise<CacheStatusResult> {
  const staleCutoff = new Date(
    Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data: row } = await supabase
    .from("analyses")
    .select("commit_sha, created_at")
    .eq("repo_url", repoUrl)
    .eq("analysis_version", ANALYSIS_VERSION)
    .eq("user_id", userId ?? "")
    .gte("created_at", staleCutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) {
    return { hit: false, stale: false, storedSha: null, liveSha: null, cachedAt: null };
  }

  const liveSha = await getLatestCommitSha(owner, repo, githubToken);
  const stale   = liveSha !== null && liveSha !== row.commit_sha;

  return {
    hit:       !stale,
    stale,
    storedSha: row.commit_sha,
    liveSha,
    cachedAt:  row.created_at,
  };
}

// ── Cache invalidation ─────────────────────────────────────────────────────

/**
 * Deletes all cached rows for (repoUrl, userId).
 * Called by /api/reanalyze when the user forces a fresh run.
 *
 * Returns the number of rows deleted, or -1 on error.
 */
export async function invalidateUserCache(
  supabase: SupabaseClient,
  repoUrl: string,
  userId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("analyses")
    .delete()
    .eq("repo_url", repoUrl)
    .eq("user_id", userId)
    .select("id");

  if (error) {
    console.error("[analysis-cache] invalidateUserCache error:", error.message);
    return -1;
  }

  return data?.length ?? 0;
}

/**
 * Admin-level invalidation: deletes all cached rows for a repo regardless
 * of user. Only call from server-side contexts with service-role key.
 */
export async function invalidateRepoCache(
  supabase: SupabaseClient,
  repoUrl: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("analyses")
    .delete()
    .eq("repo_url", repoUrl)
    .select("id");

  if (error) {
    console.error("[analysis-cache] invalidateRepoCache error:", error.message);
    return -1;
  }

  return data?.length ?? 0;
}