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

export interface MemoryCacheOptions {
    /** Nombre maximal d'entrées ; au-delà, la moins récemment utilisée est évincée. */
    maxEntries?: number;
    /** Volume maximal estimé (JSON sérialisé, en octets) de l'ensemble des valeurs. */
    maxBytes?: number;
    /** Intervalle minimal entre deux purges des entrées expirées jamais relues. */
    sweepIntervalMs?: number;
    /** Horloge injectable (tests). */
    now?: () => number;
}

type MemoryEntry = { value: unknown; expiresAt: number; bytes: number };

/**
 * Cache mémoire borné (N28). C'est le cache de production (instance unique,
 * sans Upstash) : ses clés portent l'URL, ses paramètres et l'utilisateur, il
 * doit donc rester borné en nombre d'entrées et en volume. Éviction LRU (ordre
 * d'insertion de la Map, rafraîchi à chaque lecture) et purge périodique des
 * entrées expirées lors des écritures.
 */
export class MemoryCache implements CacheService {
    private cache: Map<string, MemoryEntry> = new Map();
    private totalBytes = 0;
    private lastSweep: number;
    private readonly maxEntries: number;
    private readonly maxBytes: number;
    private readonly sweepIntervalMs: number;
    private readonly now: () => number;

    constructor(options: MemoryCacheOptions = {}) {
        this.maxEntries = options.maxEntries ?? 5_000;
        this.maxBytes = options.maxBytes ?? 64 * 1024 * 1024;
        this.sweepIntervalMs = options.sweepIntervalMs ?? 60_000;
        this.now = options.now ?? Date.now;
        this.lastSweep = this.now();
    }

    get size(): number {
        return this.cache.size;
    }

    get bytes(): number {
        return this.totalBytes;
    }

    async get<T>(key: string): Promise<T | null> {
        const item = this.cache.get(key);
        if (!item) return null;
        if (item.expiresAt < this.now()) {
            this.remove(key);
            return null;
        }
        // Rafraîchit la position LRU.
        this.cache.delete(key);
        this.cache.set(key, item);
        return item.value as T;
    }

    async set(key: string, value: unknown, ttl = 3600): Promise<void> {
        this.remove(key);
        this.sweepExpired();

        let bytes: number;
        try {
            bytes = Buffer.byteLength(key) + Buffer.byteLength(JSON.stringify(value) ?? "");
        } catch {
            return; // valeur non sérialisable : non mise en cache (simple défaut de cache)
        }
        if (bytes > this.maxBytes) return;

        this.cache.set(key, { value, expiresAt: this.now() + ttl * 1000, bytes });
        this.totalBytes += bytes;

        for (const oldest of this.cache.keys()) {
            if (this.cache.size <= this.maxEntries && this.totalBytes <= this.maxBytes) break;
            this.remove(oldest);
        }
    }

    async delete(key: string): Promise<void> {
        this.remove(key);
    }

    async clear(pattern?: string): Promise<void> {
        if (pattern) {
            const prefix = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern;
            const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(pattern.endsWith("*") ? `^${escaped}.*` : `^${escaped}$`);
            for (const key of this.cache.keys()) {
                if (regex.test(key)) this.remove(key);
            }
        } else {
            this.cache.clear();
            this.totalBytes = 0;
        }
    }

    private remove(key: string): void {
        const item = this.cache.get(key);
        if (!item) return;
        this.cache.delete(key);
        this.totalBytes -= item.bytes;
    }

    private sweepExpired(): void {
        const now = this.now();
        if (now - this.lastSweep < this.sweepIntervalMs) return;
        this.lastSweep = now;
        for (const [key, item] of this.cache) {
            if (item.expiresAt < now) this.remove(key);
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
