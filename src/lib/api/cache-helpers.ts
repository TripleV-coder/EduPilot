/**
 * Cache helpers for API routes
 * Provides caching layer for frequently accessed data
 */

import { getCacheService } from "@/lib/cache/redis";
const cache = getCacheService();
import { NextResponse } from "next/server";

/**
 * Cache options for API responses
 */
export interface CacheOptions {
  ttl?: number; // Time to live in seconds (default: 300 = 5 minutes)
  key?: string; // Custom cache key
  tags?: string[]; // Cache tags for invalidation
}

/**
 * Generate cache key from request
 */
export function generateCacheKey(
  pathname: string,
  searchParams?: URLSearchParams,
  userId?: string
): string {
  const params = searchParams ? Array.from(searchParams.entries()).sort() : [];
  const paramsStr = params.length > 0 ? `:${JSON.stringify(params)}` : "";
  const userStr = userId ? `:user:${userId}` : "";
  return ["api", pathname, paramsStr, userStr].filter(Boolean).join(":");
}

/**
 * Get cached response or execute handler
 */
export async function withCache<T>(
  handler: () => Promise<NextResponse<T>>,
  options: CacheOptions = {}
): Promise<NextResponse<T>> {
  const { ttl = 300, key } = options;

  // Skip caching in development or if no cache key
  if (process.env.NODE_ENV === "development" || !key) {
    return handler();
  }

  try {
    // Try to get from cache
    const cached = await cache.get<{ body: T; headers: Record<string, string> }>(key);
    if (cached) {
      return NextResponse.json(cached.body, {
        headers: {
          ...cached.headers,
          "X-Cache": "HIT",
          "Cache-Control": `public, max-age=${ttl}`,
        },
      });
    }

    // Execute handler and cache result
    const response = await handler();
    const body = await response.json();

    await cache.set(
      key,
      {
        body,
        headers: Object.fromEntries(response.headers.entries()),
      },
      ttl
    );

    return NextResponse.json(body, {
      headers: {
        ...Object.fromEntries(response.headers.entries()),
        "X-Cache": "MISS",
        "Cache-Control": `public, max-age=${ttl}`,
      },
    });
  } catch (_err) {
    // If caching fails, just execute handler
    return handler();
  }
}

/**
 * Invalidate cache by pattern (glob: * = any chars)
 * Ex: invalidateCache("edupilot:api:*") vide tout le cache API.
 */
export async function invalidateCache(pattern: string): Promise<void> {
  await cache.clear(pattern);
}

/**
 * Invalidate all API cache entries for a given path prefix.
 * Use after POST/PATCH/DELETE on a resource so list/detail caches stay fresh.
 * Ex: invalidateByPath("/api/students") invalide tous les caches /api/students*
 */
export async function invalidateByPath(pathPrefix: string): Promise<void> {
  const prefix = pathPrefix.startsWith("/") ? pathPrefix : `/${pathPrefix}`;
  const pattern = `api:${prefix}*`;
  await cache.clear(pattern);
}

/**
 * Predefined path prefixes for cache invalidation (use after mutations).
 * Strategy: invalider le chemin correspondant après toute modification.
 */
export const CACHE_PATHS = {
  users: "/api/users",
  students: "/api/students",
  teachers: "/api/teachers",
  classes: "/api/classes",
  schools: "/api/schools",
  grades: "/api/grades",
  payments: "/api/finance/payments",
  messages: "/api/messages",
  announcements: "/api/announcements",
  homework: "/api/homework",
  resources: "/api/resources",
} as const;

/** TTL courts pour données souvent mises à jour (ex: listes) */
export const CACHE_TTL_SHORT = 60;
/** TTL moyen pour tableaux de bord et stats */
export const CACHE_TTL_MEDIUM = 120;
/** TTL long pour données de référence */
export const CACHE_TTL_LONG = 300;

/**
 * Cache middleware for API routes
 */
export function cacheMiddleware<T = any>(options: CacheOptions = {}) {
  return async function (
    handler: () => Promise<NextResponse<T>>,
    request: Request,
    userId?: string
  ): Promise<NextResponse<T>> {
    const url = new URL(request.url);
    const cacheKey = options.key || generateCacheKey(url.pathname, url.searchParams, userId);
    return withCache<T>(handler, { ...options, key: cacheKey });
  };
}
