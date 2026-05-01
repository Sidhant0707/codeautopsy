import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export const ratelimitFree = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(3, "24 h"),
  analytics: true,
  prefix: "@upstash/ratelimit/free",
});

export const ratelimitAuth = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(50, "24 h"), 
  analytics: true,
  prefix: "@upstash/ratelimit/auth",
});