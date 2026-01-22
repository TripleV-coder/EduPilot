import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { logger } from "@/lib/utils/logger";

// Initialize Redis client
// Use Upstash Redis or local Redis
let redis: Redis;

try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  } else {
    // Fallback to in-memory store for development
    redis = new Redis({
      url: process.env.REDIS_URL || "http://localhost:6379",
      token: "",
    });
  }
} catch (_error) {
  logger.warn("Redis connection failed, using memory store for rate limiting");
  // Create a mock Redis for development
  redis = {
    get: async () => null,
    set: async () => "OK",
    incr: async () => 1,
    expire: async () => 1,
  } as any;
}

// Create rate limiters with different limits
export const apiLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, "1 m"), // 100 requests per minute
  analytics: true,
  prefix: "@edupilot/ratelimit",
});

export const authLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, "15 m"), // 5 attempts per 15 minutes
  analytics: true,
  prefix: "@edupilot/auth-ratelimit",
});

export const uploadLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 uploads per minute
  analytics: true,
  prefix: "@edupilot/upload-ratelimit",
});

export const strictLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "1 m"), // 20 requests per minute for sensitive operations
  analytics: true,
  prefix: "@edupilot/strict-ratelimit",
});

// Helper function to check rate limit
export async function checkRateLimit(
  limiter: Ratelimit,
  identifier: string
): Promise<{ success: boolean; remaining: number; reset: Date }> {
  try {
    const { success, limit: _limit, remaining, reset } = await limiter.limit(identifier);
    return {
      success,
      remaining,
      reset: new Date(reset),
    };
  } catch (error) {
    logger.error("Rate limit check failed:", error as Error);
    // Fail open - allow the request if rate limiting fails
    return {
      success: true,
      remaining: 0,
      reset: new Date(),
    };
  }
}

// Middleware helper for Next.js API routes
export function getRateLimitIdentifier(request: Request): string {
  // Try to get IP from various headers (for proxy/load balancer setups)
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  if (realIp) {
    return realIp;
  }

  // Fallback to a generic identifier
  return "unknown";
}
