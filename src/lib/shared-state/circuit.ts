/**
 * Coupe-circuit Redis (audit H6).
 *
 * Avant : Upstash injoignable coûtait ~4,3 s à CHAQUE requête (client par
 * défaut : 5 tentatives avec attente exponentielle), et /api/auth/csrf
 * finissait en 500. Désormais :
 *   - chaque commande est bornée à REDIS_TIMEOUT_MS (client sans tentative,
 *     `AbortSignal.timeout`, doublé d'une course contre une minuterie) ;
 *   - au premier échec, le circuit s'ouvre REDIS_OPEN_MS : les appels suivants
 *     passent directement au repli mémoire, sans attendre Redis ;
 *   - à l'expiration, un seul essai décide de la réouverture ou de la reprise ;
 *   - la dégradation est journalisée UNE fois par épisode, le rétablissement aussi.
 *
 * Sans dépendance Node : utilisable au middleware.
 */
import { Redis } from "@upstash/redis";
import { logger } from "@/lib/utils/logger";

export const REDIS_TIMEOUT_MS = 200;
export const REDIS_OPEN_MS = 30_000;

export interface RedisCircuitOptions {
    timeoutMs?: number;
    openMs?: number;
    now?: () => number;
    onDegraded?: (error: unknown) => void;
    onRecovered?: () => void;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Redis : pas de réponse en ${ms} ms`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export class RedisCircuit {
    private openUntil = 0;
    private degraded = false;

    constructor(private readonly options: RedisCircuitOptions = {}) {}

    private now(): number {
        return (this.options.now ?? Date.now)();
    }

    isOpen(): boolean {
        return this.now() < this.openUntil;
    }

    /** Exécute `operation` sur Redis, ou `fallback` si le circuit est ouvert ou si Redis échoue. */
    async run<T>(operation: () => Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
        if (this.isOpen()) return fallback();

        try {
            const value = await withTimeout(operation(), this.options.timeoutMs ?? REDIS_TIMEOUT_MS);
            if (this.degraded) {
                this.degraded = false;
                this.options.onRecovered?.();
            }
            return value;
        } catch (error) {
            this.openUntil = this.now() + (this.options.openMs ?? REDIS_OPEN_MS);
            if (!this.degraded) {
                this.degraded = true;
                this.options.onDegraded?.(error);
            }
            return fallback();
        }
    }
}

/** Circuit partagé par le rate-limit, le cache et le miroir de maintenance. */
export const redisCircuit = new RedisCircuit({
    onDegraded: (error) =>
        logger.warn("[Redis] injoignable — bascule sur le repli mémoire (rate-limit, cache, maintenance)", {
            module: "redis",
            reason: error instanceof Error ? error.message : String(error),
            retryInMs: REDIS_OPEN_MS,
        }),
    onRecovered: () => logger.info("[Redis] rétabli — fin du repli mémoire", { module: "redis" }),
});

/**
 * Client Upstash sans tentatives automatiques et à délai court. `null` si
 * Upstash n'est pas configuré (repli mémoire, instance unique).
 */
export function createUpstashRedis(): Redis | null {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return null;

    return new Redis({
        url,
        token,
        retry: false,
        signal: () => AbortSignal.timeout(REDIS_TIMEOUT_MS),
    });
}
