import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// Create the Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Define the rule: 3 requests per 24 hours per IP
export const ratelimit = new Ratelimit({
  redis: redis,
  limiter: Ratelimit.slidingWindow(3, "24 h"),
  analytics: true,
  prefix: "@upstash/ratelimit",
});