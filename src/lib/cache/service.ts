/**
 * Cache de réponses côté serveur — mémoire du processus, bornée (N28).
 *
 * Depuis le 2026-11-07 (Redis retiré), c'est le seul cache : il n'est
 * invalidé que par sa durée de vie (aucune invalidation sur écriture, même
 * avec Redis), donc un cache par processus sert des données aussi fraîches
 * qu'un cache partagé. Une lecture en mémoire ne coûte aucun aller-retour.
 */

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
    private hitCount = 0;
    private missCount = 0;
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

    /** Lectures servies depuis le cache / manquées, depuis le démarrage. */
    get stats(): { hits: number; misses: number } {
        return { hits: this.hitCount, misses: this.missCount };
    }

    async get<T>(key: string): Promise<T | null> {
        const item = this.cache.get(key);
        if (!item) {
            this.missCount += 1;
            return null;
        }
        if (item.expiresAt < this.now()) {
            this.remove(key);
            this.missCount += 1;
            return null;
        }
        this.hitCount += 1;
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
// Instance du processus
// ---------------------------------------------------------------------------

const globalForCache = globalThis as unknown as { __edupilotMemoryCache?: MemoryCache };
const memoryCache = (globalForCache.__edupilotMemoryCache ??= new MemoryCache());

export function getCacheService(): CacheService {
    return memoryCache;
}

/** État du cache pour la supervision : chiffres mesurés, jamais estimés. */
export function getCacheStats(): { entries: number; bytes: number; hits: number; misses: number; hitRate: number } {
    const { hits, misses } = memoryCache.stats;
    const total = hits + misses;
    return {
        entries: memoryCache.size,
        bytes: memoryCache.bytes,
        hits,
        misses,
        hitRate: total === 0 ? 0 : Math.round((hits / total) * 1000) / 10,
    };
}

/** Arrêt propre (Lot 7) : plus aucune valeur servie pendant que les dernières requêtes se terminent. */
export async function closeCache(): Promise<void> {
    await memoryCache.clear();
}
