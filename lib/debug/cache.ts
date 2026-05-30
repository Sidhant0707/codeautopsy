// lib/debug/cache.ts

import crypto from "crypto";
import { redis } from "@/lib/ratelimit";
import { DebugResult } from "./types";

const CACHE_TTL_SECONDS = 3600 * 24; // 24 hours

// ── Key builder ─────────────────────────────────────────────────────────────
// Centralised so all cache operations use identical key format.
function buildCacheKey(repoUrl: string, stackTraceHash: string): string {
  return `debug:${repoUrl}:${stackTraceHash}`;
}

// ── Read ─────────────────────────────────────────────────────────────────────
export async function getCachedDebug(
  repoUrl: string,
  stackTraceHash: string
): Promise<DebugResult | null> {
  try {
    const key = buildCacheKey(repoUrl, stackTraceHash);
    const cached = await redis.get(key);

    if (!cached) return null;

    // Previously: no try/catch — corrupted Redis data crashed the request.
    try {
      return JSON.parse(cached as string) as DebugResult;
    } catch {
      console.warn(
        `[cache] Corrupted cache entry for key ${key} — discarding.`
      );
      await redis.del(key);
      return null;
    }
  } catch (err) {
    console.error("[cache] Cache fetch error:", err);
    return null;
  }
}

// ── Write ─────────────────────────────────────────────────────────────────────
export async function cacheDebug(
  repoUrl: string,
  stackTraceHash: string,
  result: DebugResult
): Promise<void> {
  try {
    const key = buildCacheKey(repoUrl, stackTraceHash);
    await redis.set(key, JSON.stringify(result), { ex: CACHE_TTL_SECONDS });
  } catch (err) {
    console.error("[cache] Cache write error:", err);
  }
}

// ── Invalidate ────────────────────────────────────────────────────────────────
// Call this whenever a repo is re-analyzed so stale diagnosis
// results don't persist for 24 hours after new analysis is stored.
export async function invalidateRepoCache(repoUrl: string): Promise<void> {
  try {
    // Redis SCAN to find all keys matching this repo
    let cursor = "0";
    const pattern = `debug:${repoUrl}:*`;

    do {
      const [nextCursor, keys]: [string, string[]] = await (redis as unknown as { scan: (...args: unknown[]) => Promise<[string, string[]]> }).scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(
          `[cache] Invalidated ${keys.length} cache entries for ${repoUrl}`
        );
      }
    } while (cursor !== "0");
  } catch (err) {
    console.error("[cache] Cache invalidation error:", err);
  }
}

// ── Hash ──────────────────────────────────────────────────────────────────────
export function hashStackTrace(trace: string): string {
  // 16 hex chars = 64 bits of SHA-256 — sufficient for cache keys
  // where collision risk is acceptable (worst case: a cache miss).
  return crypto.createHash("sha256").update(trace).digest("hex").slice(0, 16);
}