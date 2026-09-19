/**
 * Limites de débit — module unique (L3, décision du propriétaire du 2026-09-18).
 *
 * Remplace `lib/rate-limit.ts` (paquet @upstash/ratelimit), `lib/auth/rate-limiter.ts`
 * (moteur maison) et `lib/api/middleware-rate-limit.ts` (surcouche de mappage).
 * Deux moteurs coexistaient, avec deux magasins mémoire distincts : une même
 * adresse pouvait consommer deux quotas séparés selon la porte d'entrée.
 *
 * Moteur retenu : INCR + EXPIRE. C'est le seul qui sache **rendre** une unité
 * consommée (`releaseRateLimit`), ce dont dépend le correctif H4 — seuls les
 * échecs de connexion comptent.
 *
 * Stratégie de stockage :
 *  - Upstash configuré → Redis, partagé entre instances ;
 *  - sinon → repli mémoire (exact tant que l'application tourne en un seul
 *    processus, ce qui est le déploiement retenu).
 * Dans les deux cas, le coupe-circuit H6 bascule sur la mémoire dès que Redis
 * dépasse son délai, pour que l'application ne soit jamais sans limite.
 */

import type { NextRequest } from "next/server";
import type { Redis } from "@upstash/redis";
import { createUpstashRedis, redisCircuit } from "@/lib/redis/circuit";
import { getClientIp as getTrustedClientIp } from "@/lib/security/client-ip";
import { logger } from "@/lib/utils/logger";

// ─── Types publics ────────────────────────────────────────────────────────────

export interface RateLimitConfig {
    /** Nombre d'unités autorisées par fenêtre. */
    maxAttempts: number;
    /** Durée de la fenêtre, en millisecondes. */
    windowMs: number;
}

/** Limiteur nommé : le nom donne son propre seau à chaque famille d'appels. */
export interface LimiterHandle {
    name: string;
    config: RateLimitConfig;
}

export interface RateLimitResult {
    success: boolean;
    remaining: number;
    reset: Date;
}

// ─── Magasin mémoire ──────────────────────────────────────────────────────────

interface MemoryEntry {
    count: number;
    resetTime: number;
}

class InMemoryStore {
    private store = new Map<string, MemoryEntry>();

    constructor() {
        const interval = setInterval(() => {
            const now = Date.now();
            for (const [key, entry] of this.store.entries()) {
                if (entry.resetTime < now) this.store.delete(key);
            }
        }, 5 * 60 * 1000);
        if (interval.unref) interval.unref();
    }

    get(key: string): MemoryEntry | undefined {
        const entry = this.store.get(key);
        if (entry && entry.resetTime < Date.now()) {
            this.store.delete(key);
            return undefined;
        }
        return entry;
    }

    set(key: string, value: MemoryEntry): void {
        this.store.set(key, value);
    }

    delete(key: string): void {
        this.store.delete(key);
    }
}

const memoryStore = new InMemoryStore();

// ─── Client Redis ─────────────────────────────────────────────────────────────

const hasUpstash = !!(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

if (!hasUpstash && process.env.NODE_ENV === "production") {
    // Déploiement retenu : un seul processus (image Docker). Le repli mémoire
    // est alors exact ; il ne le serait plus avec plusieurs instances.
    logger.info(
        "[RateLimit] Limites en mémoire (instance unique). Ne pas lancer plusieurs " +
        "instances sans magasin partagé : les limites seraient multipliées."
    );
}

let redisClient: Redis | null = null;
function getRedis(): Redis | null {
    // Client borné (H6) : sans tentatives automatiques, délai court.
    if (!redisClient) redisClient = createUpstashRedis();
    return redisClient;
}

// ─── Moteur ───────────────────────────────────────────────────────────────────

/** Les erreurs remontent au coupe-circuit, qui bascule sur le repli mémoire. */
async function consumeRedis(
    redis: Redis,
    key: string,
    config: RateLimitConfig
): Promise<RateLimitResult> {
    const windowSec = Math.ceil(config.windowMs / 1000);
    const resetTime = Date.now() + config.windowMs;

    const pipeline = redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, windowSec, "NX"); // seulement si la clé vient d'être créée
    const [count] = (await pipeline.exec()) as [number, number];

    return {
        success: count <= config.maxAttempts,
        remaining: Math.max(0, config.maxAttempts - count),
        reset: new Date(resetTime),
    };
}

function consumeMemory(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    const entry = memoryStore.get(key);

    if (!entry) {
        const resetTime = now + config.windowMs;
        memoryStore.set(key, { count: 1, resetTime });
        return {
            success: true,
            remaining: config.maxAttempts - 1,
            reset: new Date(resetTime),
        };
    }

    if (entry.count >= config.maxAttempts) {
        return { success: false, remaining: 0, reset: new Date(entry.resetTime) };
    }

    entry.count += 1;
    memoryStore.set(key, entry);
    return {
        success: true,
        remaining: config.maxAttempts - entry.count,
        reset: new Date(entry.resetTime),
    };
}

// ─── API publique ─────────────────────────────────────────────────────────────

/**
 * Consomme une unité sur une clé construite par l'appelant.
 * Réservé aux compteurs dont la clé porte déjà son propre préfixe
 * (`createRateLimitKey`), par exemple les échecs de connexion.
 */
export async function checkRateLimitKey(
    key: string,
    config: RateLimitConfig
): Promise<RateLimitResult> {
    const redis = getRedis();
    if (!redis) return consumeMemory(key, config);
    return redisCircuit.run(
        () => consumeRedis(redis, key, config),
        () => consumeMemory(key, config)
    );
}

/**
 * Consomme une unité sur un limiteur nommé.
 *
 * Le nom entre dans la clé : chaque limiteur garde son propre seau. Sans cela,
 * toutes les familles d'appels partageraient un compteur, et la limite la plus
 * stricte bloquerait l'application entière en quelques requêtes.
 */
export async function checkRateLimit(
    handle: LimiterHandle,
    identifier: string
): Promise<RateLimitResult> {
    return checkRateLimitKey(createRateLimitKey(handle.name, identifier), handle.config);
}

/** Remet un compteur à zéro (ex. second facteur validé). */
export async function resetRateLimit(key: string): Promise<void> {
    memoryStore.delete(key);
    const redis = getRedis();
    if (!redis) return;
    await redisCircuit.run(
        async () => {
            await redis.del(key);
        },
        () => undefined
    );
}

/**
 * Rend une unité consommée (ex. connexion réussie : seuls les échecs doivent
 * compter). Compter AVANT puis rendre en cas de succès évite qu'une rafale
 * parallèle dépasse la limite.
 */
export async function releaseRateLimit(key: string): Promise<void> {
    const redis = getRedis();
    if (redis) {
        const released = await redisCircuit.run(
            async () => {
                const remaining = await redis.decr(key);
                if (remaining <= 0) await redis.del(key);
                return true;
            },
            () => false
        );
        if (released) return;
    }
    const entry = memoryStore.get(key);
    if (!entry) return;
    entry.count -= 1;
    if (entry.count <= 0) memoryStore.delete(key);
    else memoryStore.set(key, entry);
}

/** Rend l'unité consommée par `checkRateLimit` pour ce limiteur nommé. */
export async function releaseLimiter(
    handle: LimiterHandle,
    identifier: string
): Promise<void> {
    await releaseRateLimit(createRateLimitKey(handle.name, identifier));
}

export function createRateLimitKey(prefix: string, identifier: string): string {
    return `rl:${prefix}:${identifier}`;
}

/** IP client de confiance (source unique : `@/lib/security/client-ip`, audit H3). */
export function getClientIp(request: Request): string {
    return getTrustedClientIp(request.headers);
}

/** Identifiant de client pour le middleware — jamais un en-tête fourni par le client (H3). */
export function getClientIdentifier(request: NextRequest | Request): string {
    return getTrustedClientIp(request.headers);
}

// ─── Limiteurs nommés ─────────────────────────────────────────────────────────

// Assouplir les limites en développement pour éviter les ralentissements.
// RATE_LIMIT_RELAXED=true : réservé au CI e2e, où `next start` force
// NODE_ENV=production alors que toute la suite Playwright partage une seule
// IP — les limites prod (ex. strict 20/min) la bloqueraient en quelques
// secondes. Ne jamais définir cette variable en production réelle.
const isDev =
    process.env.NODE_ENV === "development" ||
    process.env.RATE_LIMIT_RELAXED === "true";

/** API générale : 100 req / minute par IP (500 en dev). */
export const apiLimiter: LimiterHandle = {
    name: "api",
    config: { maxAttempts: isDev ? 500 : 100, windowMs: 60 * 1000 },
};

/** Auth (login, mot de passe oublié) : 5 essais / 15 minutes (20 en dev). */
export const authLimiter: LimiterHandle = {
    name: "auth",
    config: { maxAttempts: isDev ? 20 : 5, windowMs: 15 * 60 * 1000 },
};

/** Opérations sensibles (paiements, notes, comptes) : 20 req / minute (100 en dev). */
export const strictLimiter: LimiterHandle = {
    name: "strict",
    config: { maxAttempts: isDev ? 100 : 20, windowMs: 60 * 1000 },
};

/** Envoi de fichiers : 10 / minute (50 en dev). */
export const uploadLimiter: LimiterHandle = {
    name: "upload",
    config: { maxAttempts: isDev ? 50 : 10, windowMs: 60 * 1000 },
};

// ─── Configurations nommées (clé construite par l'appelant) ───────────────────

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
    windowMs: 15 * 60 * 1000,
};

export const FORGOT_PASSWORD_RATE_LIMIT: RateLimitConfig = {
    maxAttempts: 3,
    windowMs: 15 * 60 * 1000,
};

/**
 * Vérification du second facteur. Un TOTP ne fait que 6 chiffres (10^6
 * combinaisons) et reste valide ~30 s : sans plafond, un code est devinable par
 * force brute. Plus strict que le login, car la victime a déjà franchi l'étape
 * du mot de passe.
 */
export const MFA_VERIFY_RATE_LIMIT: RateLimitConfig = {
    maxAttempts: 5,
    windowMs: 10 * 60 * 1000,
};

export const API_RATE_LIMIT: RateLimitConfig = {
    maxAttempts: 100,
    windowMs: 60 * 1000,
};

// ─── Mappage route → limiteur ─────────────────────────────────────────────────

/** Limiteur applicable à un chemin d'API, ou `null` hors API. */
export function getLimiterForRoute(pathname: string): LimiterHandle | null {
    if (
        pathname.includes("/api/auth/login") ||
        pathname.includes("/api/auth/forgot-password")
    ) {
        return authLimiter;
    }

    const sensitiveRoutes = [
        "/api/payments",
        "/api/grades",
        "/api/users",
        "/api/schools",
        "/api/upload",
    ];
    if (sensitiveRoutes.some((route) => pathname.startsWith(route))) {
        return strictLimiter;
    }

    if (pathname.startsWith("/api/")) return apiLimiter;

    return null;
}
