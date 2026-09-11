/**
 * Rate Limiter pour l'authentification — multi-instance via Upstash Redis
 *
 * Stratégie :
 * - Si UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN sont configurés :
 *   → Utilise Redis (partagé entre toutes les instances PM2/pods).
 * - Sinon (dev ou Redis non configuré) :
 *   → Fallback en mémoire (single-instance uniquement).
 *
 * Algorithme : sliding window counter avec INCR + EXPIREAT Redis.
 */

import { getClientIp as getTrustedClientIp } from "@/lib/security/client-ip";

// ---------------------------------------------------------------------------
// In-memory fallback
// ---------------------------------------------------------------------------

interface RateLimitEntry {
    count: number;
    resetTime: number;
}

class InMemoryStore {
    private store = new Map<string, RateLimitEntry>();

    constructor() {
        const interval = setInterval(() => {
            const now = Date.now();
            for (const [key, entry] of this.store.entries()) {
                if (entry.resetTime < now) this.store.delete(key);
            }
        }, 5 * 60 * 1000);
        if (interval.unref) interval.unref();
    }

    get(key: string): RateLimitEntry | undefined {
        const entry = this.store.get(key);
        if (entry && entry.resetTime < Date.now()) {
            this.store.delete(key);
            return undefined;
        }
        return entry;
    }

    set(key: string, value: RateLimitEntry): void {
        this.store.set(key, value);
    }

    delete(key: string): void {
        this.store.delete(key);
    }
}

const memoryStore = new InMemoryStore();

// ---------------------------------------------------------------------------
// Redis client (lazy-loaded pour éviter l'import côté client)
// ---------------------------------------------------------------------------

let redisClient: import("@upstash/redis").Redis | null = null;

function getRedis(): import("@upstash/redis").Redis | null {
    if (redisClient) return redisClient;
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
        return null;
    }
    try {
        // Chargement dynamique pour éviter les erreurs si le module n'est pas installé
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { Redis } = require("@upstash/redis");
        redisClient = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
        return redisClient;
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Types publics
// ---------------------------------------------------------------------------

export interface RateLimitConfig {
    maxAttempts: number;
    windowMs: number;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetTime: number;
}

// ---------------------------------------------------------------------------
// Implémentation Redis (sliding window)
// ---------------------------------------------------------------------------

async function checkRateLimitRedis(
    identifier: string,
    config: RateLimitConfig
): Promise<RateLimitResult> {
    const redis = getRedis()!;
    const windowSec = Math.ceil(config.windowMs / 1000);
    const now = Date.now();
    const resetTime = now + config.windowMs;

    try {
        // Pipeline : INCR + EXPIRE atomique
        const pipeline = redis.pipeline();
        pipeline.incr(identifier);
        pipeline.expire(identifier, windowSec, "NX"); // Expire seulement si la clé vient d'être créée
        const [count] = (await pipeline.exec()) as [number, number];

        const allowed = count <= config.maxAttempts;
        return {
            allowed,
            remaining: Math.max(0, config.maxAttempts - count),
            resetTime,
        };
    } catch {
        // En cas d'erreur Redis, dégrader vers in-memory (fail open)
        return checkRateLimitMemory(identifier, config);
    }
}

async function resetRateLimitRedis(identifier: string): Promise<void> {
    const redis = getRedis()!;
    try {
        await redis.del(identifier);
    } catch {
        memoryStore.delete(identifier);
    }
}

// ---------------------------------------------------------------------------
// Implémentation in-memory (synchrone, fallback)
// ---------------------------------------------------------------------------

function checkRateLimitMemory(
    identifier: string,
    config: RateLimitConfig
): RateLimitResult {
    const now = Date.now();
    const entry = memoryStore.get(identifier);

    if (!entry) {
        const resetTime = now + config.windowMs;
        memoryStore.set(identifier, { count: 1, resetTime });
        return { allowed: true, remaining: config.maxAttempts - 1, resetTime };
    }

    if (entry.count >= config.maxAttempts) {
        return { allowed: false, remaining: 0, resetTime: entry.resetTime };
    }

    entry.count++;
    memoryStore.set(identifier, entry);
    return {
        allowed: true,
        remaining: config.maxAttempts - entry.count,
        resetTime: entry.resetTime,
    };
}

// ---------------------------------------------------------------------------
// API publique (async, compatible Redis + fallback)
// ---------------------------------------------------------------------------

/**
 * Vérifie si une requête est autorisée selon le rate limit.
 * Utilise Redis si configuré, sinon fallback in-memory.
 */
export async function checkRateLimit(
    identifier: string,
    config: RateLimitConfig
): Promise<RateLimitResult> {
    if (getRedis()) {
        return checkRateLimitRedis(identifier, config);
    }
    return checkRateLimitMemory(identifier, config);
}

/**
 * Réinitialise le compteur (ex: après login réussi).
 */
export async function resetRateLimit(identifier: string): Promise<void> {
    if (getRedis()) {
        return resetRateLimitRedis(identifier);
    }
    memoryStore.delete(identifier);
}

/**
 * Rend une unité consommée par `checkRateLimit` (ex. connexion réussie :
 * seuls les échecs doivent compter). Compter AVANT puis rendre en cas de
 * succès évite qu'une rafale parallèle dépasse la limite.
 */
export async function releaseRateLimit(identifier: string): Promise<void> {
    const redis = getRedis();
    if (redis) {
        try {
            const remaining = await redis.decr(identifier);
            if (remaining <= 0) await redis.del(identifier);
            return;
        } catch {
            // Redis indisponible : même dégradation que checkRateLimitRedis.
        }
    }
    const entry = memoryStore.get(identifier);
    if (!entry) return;
    entry.count -= 1;
    if (entry.count <= 0) memoryStore.delete(identifier);
    else memoryStore.set(identifier, entry);
}

// ---------------------------------------------------------------------------
// Configurations prédéfinies
// ---------------------------------------------------------------------------

/**
 * Échecs de connexion par IP (audit H4). Seuls les échecs comptent : une
 * école derrière une même IP publique, ou des mobiles derrière le NAT de
 * l'opérateur, peuvent se connecter en nombre sans être bloqués.
 */
export const LOGIN_FAILURE_RATE_LIMIT: RateLimitConfig = {
    maxAttempts: 10,
    windowMs: 15 * 60 * 1000,
};

export const LOGIN_RATE_LIMIT: RateLimitConfig = {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
};

export const FORGOT_PASSWORD_RATE_LIMIT: RateLimitConfig = {
    maxAttempts: 3,
    windowMs: 15 * 60 * 1000,
};

/**
 * Vérification du second facteur. Un TOTP ne fait que 6 chiffres (10^6
 * combinaisons) et reste valide ~30 s : sans plafond, un code est devinable par
 * force brute. On est plus strict que le login car la victime a déjà franchi
 * l'étape mot de passe.
 */
export const MFA_VERIFY_RATE_LIMIT: RateLimitConfig = {
    maxAttempts: 5,
    windowMs: 10 * 60 * 1000, // 10 minutes
};

export const API_RATE_LIMIT: RateLimitConfig = {
    maxAttempts: 100,
    windowMs: 60 * 1000, // 1 minute
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** IP client de confiance (source unique : `@/lib/security/client-ip`, audit H3). */
export function getClientIp(request: Request): string {
    return getTrustedClientIp(request.headers);
}

export function createRateLimitKey(prefix: string, identifier: string): string {
    return `rl:${prefix}:${identifier}`;
}
