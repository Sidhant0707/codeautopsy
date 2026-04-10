import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export async function GET() {
  try {
    const headerList = await headers();
    const ip = headerList.get("x-forwarded-for") ?? "127.0.0.1";
    
    // Upstash Ratelimit saves keys in this format: @upstash/ratelimit:<ip>
    const key = `@upstash/ratelimit:${ip}`;
    const count = await redis.get<number>(key);
    
    // If no key exists, they haven't used any yet, so 3 are remaining
    const remaining = count !== null ? Math.max(0, 3 - count) : 3;

    return NextResponse.json({ remaining });
  } catch (err) {
    return NextResponse.json({ remaining: 3 }); // Fallback
  }
}