/**
 * Redis Cache — unifié sur @upstash/redis
 *
 * Supporte :
 * - Upstash Redis REST (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
 * - Redis standard via URL redis:// (REDIS_URL) — utilise le mode compatibilité Upstash
 *
 * Suppression de la dépendance ioredis (remplacée par @upstash/redis).
 */

import { logger } from "@/lib/utils/logger";
import { createUpstashRedis, redisCircuit } from "@/lib/redis/circuit";

let _upstashRedis: import("@upstash/redis").Redis | null = null;

function getUpstashClient(): import("@upstash/redis").Redis | null {
    if (_upstashRedis) return _upstashRedis;

    const restUrl = process.env.UPSTASH_REDIS_REST_URL;
    const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!restUrl || !restToken) {
        if (process.env.NODE_ENV === "production") {
            logger.warn("Redis non configuré (UPSTASH_REDIS_REST_URL/TOKEN manquants) — cache désactivé", {
                module: "cache",
            });
        }
        return null;
    }

    // Client borné (H6) : sans tentatives automatiques, délai court.
    _upstashRedis = createUpstashRedis();
    logger.info("Redis configuré (Upstash)", { module: "cache" });
    return _upstashRedis;
}

// ---------------------------------------------------------------------------
// Interface CacheService
// ---------------------------------------------------------------------------

export interface CacheService {
    get<T>(key: string): Promise<T | null>;
    set(key: string, value: unknown, ttl?: number): Promise<void>;
    delete(key: string): Promise<void>;
    clear(pattern?: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Implémentation in-memory (fallback)
// ---------------------------------------------------------------------------

class MemoryCache implements CacheService {
    private cache: Map<string, { value: unknown; expiresAt: number }> = new Map();

    async get<T>(key: string): Promise<T | null> {
        const item = this.cache.get(key);
        if (!item) return null;
        if (item.expiresAt < Date.now()) {
            this.cache.delete(key);
            return null;
        }
        return item.value as T;
    }

    async set(key: string, value: unknown, ttl = 3600): Promise<void> {
        this.cache.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
    }

    async delete(key: string): Promise<void> {
        this.cache.delete(key);
    }

    async clear(pattern?: string): Promise<void> {
        if (pattern) {
            const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern;
            const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(pattern.endsWith("*") ? `^${escaped}.*` : `^${escaped}$`);
            for (const key of this.cache.keys()) {
                if (regex.test(key)) this.cache.delete(key);
            }
        } else {
            this.cache.clear();
        }
    }
}

// ---------------------------------------------------------------------------
// Implémentation Upstash Redis
// ---------------------------------------------------------------------------

class UpstashCache implements CacheService {
    constructor(private client: import("@upstash/redis").Redis) {}

    // Redis lent ou injoignable : le coupe-circuit (H6) bascule sur le cache
    // mémoire de l'instance, sans attendre ni journaliser à chaque appel.

    async get<T>(key: string): Promise<T | null> {
        const value = await redisCircuit.run(
            () => this.client.get<string>(key),
            () => memoryFallback.get<string>(key),
        );
        if (value === null || value === undefined) return null;
        // Upstash retourne déjà l'objet désérialisé pour les valeurs JSON
        if (typeof value === "string") {
            try { return JSON.parse(value) as T; } catch { return value as unknown as T; }
        }
        return value as unknown as T;
    }

    async set(key: string, value: unknown, ttl = 3600): Promise<void> {
        await redisCircuit.run(
            async () => { await this.client.setex(key, ttl, JSON.stringify(value)); },
            () => memoryFallback.set(key, JSON.stringify(value), ttl),
        );
    }

    async delete(key: string): Promise<void> {
        await memoryFallback.delete(key);
        await redisCircuit.run(async () => { await this.client.del(key); }, () => undefined);
    }

    async clear(pattern?: string): Promise<void> {
        await memoryFallback.clear(pattern);
        if (!pattern) return;
        await redisCircuit.run(async () => {
            const keys = await this.client.keys(pattern);
            if (keys.length > 0) await this.client.del(...keys);
        }, () => undefined);
    }
}

// ---------------------------------------------------------------------------
// Factory — retourne Redis ou MemoryCache
// ---------------------------------------------------------------------------

const memoryFallback = new MemoryCache();
let cacheInstance: CacheService | null = null;

export function getCacheService(): CacheService {
    if (cacheInstance) return cacheInstance;
    const client = getUpstashClient();
    cacheInstance = client ? new UpstashCache(client) : memoryFallback;
    return cacheInstance;
}

// Compat : exports nommés utilisés par d'autres modules
export function getRedisClient() {
    return getUpstashClient();
}

export function initRedis() {
    return getUpstashClient();
}
