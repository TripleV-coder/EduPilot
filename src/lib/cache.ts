import { cache } from "react";

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  key?: string;
}

class CacheManager {
  private caches = new Map<string, { data: unknown; timestamp: number }>();
  private timers = new Map<string, NodeJS.Timeout>();

  set<T>(key: string, data: T, ttl?: number) {
    // Clear existing timer
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Store data
    this.caches.set(key, {
      data,
      timestamp: Date.now(),
    });

    // Set expiry timer if TTL provided
    if (ttl) {
      const timer = setTimeout(() => {
        this.caches.delete(key);
        this.timers.delete(key);
      }, ttl * 1000);
      this.timers.set(key, timer);
    }
  }

  get<T>(key: string): T | undefined {
    return this.caches.get(key)?.data as T | undefined;
  }

  has(key: string) {
    return this.caches.has(key);
  }

  delete(key: string) {
    this.caches.delete(key);
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
  }

  clear() {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.caches.clear();
    this.timers.clear();
  }

  getStats() {
    return {
      size: this.caches.size,
      keys: Array.from(this.caches.keys()),
    };
  }
}

export const cacheManager = new CacheManager();

/**
 * Higher-order function to cache function results
 */
export function withCache<Args extends unknown[], Ret>(
  fn: (...args: Args) => Promise<Ret>,
  options: CacheOptions = {}
): (...args: Args) => Promise<Ret> {
  const { ttl = 300, key: keyPrefix = fn.name } = options;

  return async (...args: Args) => {
    const cacheKey = `${keyPrefix}_${JSON.stringify(args)}`;

    // Return cached data if available
    if (cacheManager.has(cacheKey)) {
      const cached = cacheManager.get<Ret>(cacheKey);
      if (cached !== undefined) {
        return cached;
      }
    }

    // Fetch and cache
    try {
      const result = await fn(...args);
      cacheManager.set(cacheKey, result, ttl);
      return result;
    } catch (error) {
      throw error;
    }
  };
}

/**
 * Invalidate cache entries matching a pattern
 */
export function invalidateCache(pattern: string) {
  const stats = cacheManager.getStats();
  stats.keys.forEach((key) => {
    if (key.includes(pattern)) {
      cacheManager.delete(key);
    }
  });
}

/**
 * Clear all cache
 */
export function clearCache() {
  cacheManager.clear();
}

/**
 * React server cache for data fetching
 */
export const cachedFetch = cache(
  async (url: string, options?: RequestInit) => {
    const response = await fetch(url, {
      ...options,
      next: { revalidate: 300 }, // 5 minutes
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}`);
    }

    return response.json();
  }
);
