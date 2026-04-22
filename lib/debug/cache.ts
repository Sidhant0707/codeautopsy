// lib/debug/cache.ts

import { redis } from "@/lib/ratelimit";
import { DebugResult } from "./types";

export async function getCachedDebug(
  analysisId: string,
  stackTraceHash: string
): Promise<DebugResult | null> {
  try {
    const key = `debug:${analysisId}:${stackTraceHash}`;
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached as string) : null;
  } catch (err) {
    console.error("Cache fetch error:", err);
    return null;
  }
}

export async function cacheDebug(
  analysisId: string,
  stackTraceHash: string,
  result: DebugResult
): Promise<void> {
  try {
    const key = `debug:${analysisId}:${stackTraceHash}`;
    await redis.set(key, JSON.stringify(result), { ex: 3600 * 24 }); // 24h TTL
  } catch (err) {
    console.error("Cache write error:", err);
  }
}

// Hash function for stack traces
export function hashStackTrace(trace: string): string {
  // Simple hash using built-in crypto
  const crypto = require("crypto");
  return crypto.createHash("sha256").update(trace).digest("hex").slice(0, 16);
}