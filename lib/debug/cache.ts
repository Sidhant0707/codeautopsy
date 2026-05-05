
import crypto from "crypto";
import { redis } from "@/lib/ratelimit";
import { DebugResult } from "./types";

export async function getCachedDebug(
  repoUrl: string,
  stackTraceHash: string
): Promise<DebugResult | null> {
  try {
    const key = `debug:${repoUrl}:${stackTraceHash}`;
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached as string) : null;
  } catch (err) {
    console.error("Cache fetch error:", err);
    return null;
  }
}

export async function cacheDebug(
  repoUrl: string,
  stackTraceHash: string,
  result: DebugResult
): Promise<void> {
  try {
    const key = `debug:${repoUrl}:${stackTraceHash}`;
    await redis.set(key, JSON.stringify(result), { ex: 3600 * 24 }); 
  } catch (err) {
    console.error("Cache write error:", err);
  }
}


export function hashStackTrace(trace: string): string {
  
  return crypto.createHash("sha256").update(trace).digest("hex").slice(0, 16);
}