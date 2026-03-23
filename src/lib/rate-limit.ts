/**
 * Rate Limiting — EduPilot
 *
 * Strategy:
 *  - If UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set → Upstash Redis (multi-instance safe)
 *  - Otherwise → In-memory fallback (development only, blocked in production)
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { logger } from "@/lib/utils/logger";

// Éviter le spam de logs si Upstash est temporairement indisponible
let lastRedisFailureLogAt = 0;
function logRedisFailureOncePerWindow(error: Error) {
  const now = Date.now();
  // 60s de “cooldown” pour ce message
  if (now - lastRedisFailureLogAt < 60_000) return;
  lastRedisFailureLogAt = now;
  logger.error("[RateLimit] Redis check failed, falling back to in-memory limiter", error);
}

// ─── In-memory Fallback (dev only) ────────────────────────────────────────────

interface FallbackEntry {
  count: number;
  resetAt: number;
}

interface FallbackConfig {
  limit: number;
  windowMs: number;
}

const fallbackStore = new Map<string, FallbackEntry>();

// Periodic cleanup of expired entries (every 60s)
let lastCleanup = Date.now();
function cleanupFallbackStore() {
  const now = Date.now();
  if (now - lastCleanup < 60_000) return;
  lastCleanup = now;
  for (const [key, entry] of fallbackStore) {
    if (now > entry.resetAt) fallbackStore.delete(key);
  }
}

function checkFallbackRateLimit(
  config: FallbackConfig,
  identifier: string
): { success: boolean; remaining: number; reset: Date } {
  cleanupFallbackStore();

  const now = Date.now();
  const existing = fallbackStore.get(identifier);

  let entry = existing;
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + config.windowMs };
  }

  entry.count += 1;
  fallbackStore.set(identifier, entry);

  const remaining = Math.max(0, config.limit - entry.count);
  return {
    success: entry.count <= config.limit,
    remaining,
    reset: new Date(entry.resetAt),
  };
}

// ─── Redis + Limiters ─────────────────────────────────────────────────────────

const hasUpstash = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

if (!hasUpstash && process.env.NODE_ENV === "production") {
  logger.warn(
    "[RateLimit] ⚠️  UPSTASH_REDIS_REST_URL is not configured. " +
    "Rate limiting will use in-memory fallback which does NOT work across multiple instances. " +
    "This is a SECURITY RISK in production."
  );
}

let redis: Redis | null = null;
function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redis;
}

// Only create Upstash Ratelimit instances if Redis is configured
const createLimiter = hasUpstash
  ? (window: number, unit: "s" | "m" | "h" | "d", limit: number, prefix: string) =>
      new Ratelimit({
        redis: getRedis(),
        limiter: Ratelimit.slidingWindow(
          limit,
          `${window} ${unit}` as Parameters<typeof Ratelimit.slidingWindow>[1]
        ),
        analytics: false,
        prefix,
      })
  : null;

/** API générale : 100 req / minute par IP */
export const apiLimiter = createLimiter?.(1, "m", 100, "@edupilot/api") ?? null;

/** Auth (login, forgot-password) : 5 essais / 15 minutes */
export const authLimiter = createLimiter?.(15, "m", 5, "@edupilot/auth") ?? null;

/** Opérations sensibles (paiements, notes, users) : 20 req / minute */
export const strictLimiter = createLimiter?.(1, "m", 20, "@edupilot/strict") ?? null;

/** Upload : 10 fichiers / minute */
export const uploadLimiter = createLimiter?.(1, "m", 10, "@edupilot/upload") ?? null;

// ─── Fallback configs (must match the Upstash configs above) ──────────────────

const FALLBACK_CONFIGS: Record<string, FallbackConfig> = {
  auth:   { limit: 5,   windowMs: 15 * 60 * 1000 },
  strict: { limit: 20,  windowMs: 60 * 1000 },
  upload: { limit: 10,  windowMs: 60 * 1000 },
  api:    { limit: 100, windowMs: 60 * 1000 },
};

function getFallbackConfig(limiter: Ratelimit | null): FallbackConfig {
  if (limiter === authLimiter)   return FALLBACK_CONFIGS.auth;
  if (limiter === strictLimiter) return FALLBACK_CONFIGS.strict;
  if (limiter === uploadLimiter) return FALLBACK_CONFIGS.upload;
  return FALLBACK_CONFIGS.api;
}

// ─── Main helper ──────────────────────────────────────────────────────────────

export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<{ success: boolean; remaining: number; reset: Date }> {
  // If Upstash is not configured, use in-memory fallback directly
  if (!limiter) {
    const config = getFallbackConfig(limiter);
    return checkFallbackRateLimit(config, `fallback:${identifier}`);
  }

  try {
    const { success, remaining, reset } = await limiter.limit(identifier);
    return { success, remaining, reset: new Date(reset) };
  } catch (error) {
    // Redis failure — fall back to in-memory to avoid leaving the app unprotected
    logRedisFailureOncePerWindow(error as Error);
    const config = getFallbackConfig(limiter);
    return checkFallbackRateLimit(config, `fallback:${identifier}`);
  }
}
