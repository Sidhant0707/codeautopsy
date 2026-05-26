import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const ratelimitApiKey = new Ratelimit({
  redis: redis,                   // same redis instance already initialized
  limiter: Ratelimit.slidingWindow(30, "1 h"),
  analytics: true,
  prefix: "@upstash/ratelimit/api_key",  // separate prefix = separate bucket
});

export const ratelimitFree = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(3, "24 h"),
  analytics: true,
  prefix: "@upstash/ratelimit/free",
});

export const ratelimitAuth = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(10, "24 h"),
  analytics: true,
  prefix: "@upstash/ratelimit/auth",
});