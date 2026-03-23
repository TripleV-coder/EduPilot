/**
 * EduPilot — Cache Redis Optimisé avec Upstash
 * Cache distribué avec fallback in-memory
 */

import { Redis } from "@upstash/redis";
import { logger } from "@/lib/utils/logger";

// ─── Configuration ───────────────────────────────────────────────

const hasRedis = !!(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

let redis: Redis | null = null;

function getRedis(): Redis {
  if (!redis && hasRedis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
      automaticDeserialization: true,
    });
  }
  return redis!;
}

// ─── In-Memory Fallback ───────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry<unknown>>();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryCache.entries()) {
    if (now > entry.expiresAt) {
      memoryCache.delete(key);
    }
  }
}, 5 * 60 * 1000);

// ─── Cache Interface ───────────────────────────────────────────────

export interface CacheOptions {
  ttl?: number; // TTL in seconds (default: 300 = 5 minutes)
  prefix?: string; // Cache key prefix
}

/**
 * Get value from cache
 */
export async function getCache<T>(
  key: string,
  options: CacheOptions = {}
): Promise<T | null> {
  const fullKey = options.prefix ? `${options.prefix}:${key}` : key;

  try {
    if (hasRedis) {
      const value = await getRedis().get<T>(fullKey);
      return value || null;
    }
  } catch (error) {
    logger.error("[Cache] Redis get failed, falling back to memory", error);
  }

  // Fallback to memory cache
  const entry = memoryCache.get(fullKey);
  if (entry && Date.now() < entry.expiresAt) {
    return entry.data as T;
  }

  return null;
}

/**
 * Set value in cache
 */
export async function setCache<T>(
  key: string,
  value: T,
  options: CacheOptions = {}
): Promise<void> {
  const fullKey = options.prefix ? `${options.prefix}:${key}` : key;
  const ttl = options.ttl || 300; // 5 minutes default

  try {
    if (hasRedis) {
      await getRedis().set(fullKey, value, { ex: ttl });
      return;
    }
  } catch (error) {
    logger.error("[Cache] Redis set failed, falling back to memory", error);
  }

  // Fallback to memory cache
  memoryCache.set(fullKey, {
    data: value,
    expiresAt: Date.now() + ttl * 1000,
  });
}

/**
 * Delete value from cache
 */
export async function deleteCache(
  key: string,
  options: CacheOptions = {}
): Promise<void> {
  const fullKey = options.prefix ? `${options.prefix}:${key}` : key;

  try {
    if (hasRedis) {
      await getRedis().del(fullKey);
      return;
    }
  } catch (error) {
    logger.error("[Cache] Redis delete failed", error);
  }

  memoryCache.delete(fullKey);
}

/**
 * Delete multiple keys matching a pattern
 */
export async function deleteCachePattern(
  pattern: string,
  options: CacheOptions = {}
): Promise<void> {
  const fullPattern = options.prefix ? `${options.prefix}:${pattern}` : pattern;

  try {
    if (hasRedis) {
      const keys = await getRedis().keys(fullPattern);
      if (keys.length > 0) {
        await getRedis().del(...keys);
      }
      return;
    }
  } catch (error) {
    logger.error("[Cache] Redis pattern delete failed", error);
  }

  // Fallback: delete from memory cache
  for (const key of memoryCache.keys()) {
    if (key.includes(pattern)) {
      memoryCache.delete(key);
    }
  }
}

/**
 * Clear all cache
 */
export async function clearCache(): Promise<void> {
  try {
    if (hasRedis) {
      await getRedis().flushdb();
      return;
    }
  } catch (error) {
    logger.error("[Cache] Redis flush failed", error);
  }

  memoryCache.clear();
}

/**
 * Wrapper pour mettre en cache une fonction
 */
export function withRedisCache<Args extends unknown[], Ret>(
  fn: (...args: Args) => Promise<Ret>,
  options: CacheOptions = {}
): (...args: Args) => Promise<Ret> {
  return async (...args: Args) => {
    const cacheKey = JSON.stringify(args);
    
    // Try to get from cache
    const cached = await getCache<Ret>(cacheKey, options);
    if (cached !== null) {
      return cached;
    }

    // Execute function and cache result
    const result = await fn(...args);
    await setCache(cacheKey, result, options);
    
    return result;
  };
}

// ─── Predefined Cache Prefixes ─────────────────────────────────────

export const CACHE_PREFIXES = {
  USER: "user",
  SCHOOL: "school",
  STUDENT: "student",
  TEACHER: "teacher",
  CLASS: "class",
  GRADE: "grade",
  ATTENDANCE: "attendance",
  FINANCE: "finance",
  ANALYTICS: "analytics",
  DASHBOARD: "dashboard",
} as const;

// ─── Cache TTLs (in seconds) ───────────────────────────────────────

export const CACHE_TTLS = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 1800, // 30 minutes
  VERY_LONG: 3600, // 1 hour
  DAY: 86400, // 24 hours
} as const;
