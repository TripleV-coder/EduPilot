/**
 * Coupe-circuits des services en aval (SMS, e-mail, passerelles de paiement).
 *
 * Fermé : les appels passent ; chaque échec incrémente un compteur d'échecs
 * CONSÉCUTIFS, remis à zéro au premier succès.
 * Ouvert : après `CIRCUIT_FAILURE_THRESHOLD` échecs (5), plus aucun appel
 * pendant `CIRCUIT_OPEN_MS` (30 s) — `CircuitOpenError`, soit un 503 rapide
 * au lieu d'une attente de 20 s sur un fournisseur qui ne répond plus.
 * Demi-ouvert : à l'expiration, UN seul appel d'essai (tous pods confondus)
 * est autorisé. Succès → fermé ; échec → ouvert à nouveau pour 30 s.
 *
 * L'état vit dans Redis quand `REDIS_URL` est configuré : un fournisseur coupé
 * l'est pour tous les pods. Sans Redis, ou s'il ne répond pas, l'état est local.
 * Chaque transition est journalisée et comptée (métriques Prometheus).
 */
import type Redis from "ioredis";
import { circuitSettings, type CircuitSettings } from "@/lib/resilience/config";
import { CircuitOpenError } from "@/lib/resilience/errors";
import { recordCircuitTransition, recordRejection, type CircuitStateName } from "@/lib/resilience/metrics";
import { getTcpRedis, tcpRedisCircuit } from "@/lib/redis/tcp";
import { logger } from "@/lib/utils/logger";

/** Services en aval protégés. Les métriques exposent l'état de chacun. */
export const CIRCUITS = {
    sms: "sms",
    email: "email",
    momo: "payment-momo",
    flutterwave: "payment-flutterwave",
    paystack: "payment-paystack",
    fedapay: "payment-fedapay",
} as const;

/** Un essai demi-ouvert est déjà en cours ailleurs : réessayer peu après. */
const PROBE_BUSY_RETRY_MS = 5_000;
/** Une série d'échecs sans nouvel appel pendant 10 min est oubliée. */
const FAILURE_STREAK_TTL_MS = 10 * 60_000;

// ─── Magasin d'état ───────────────────────────────────────────────────────────

/** Opérations minimales sur des clés à durée de vie, communes à Redis et à la mémoire. */
export interface BreakerKV {
    /** Durée de vie restante en ms ; 0 ou moins si la clé n'existe pas. */
    ttlMs(key: string): Promise<number>;
    getInt(key: string): Promise<number>;
    /** Pose la clé seulement si elle est absente ; vrai si posée. */
    setIfAbsent(key: string, ttlMs: number): Promise<boolean>;
    set(key: string, ttlMs: number): Promise<void>;
    incr(key: string, ttlMs: number): Promise<number>;
    del(...keys: string[]): Promise<void>;
}

export class MemoryBreakerKV implements BreakerKV {
    private readonly entries = new Map<string, { value: number; expiresAt: number }>();

    constructor(private readonly now: () => number = Date.now) {}

    private live(key: string) {
        const entry = this.entries.get(key);
        if (entry && entry.expiresAt <= this.now()) {
            this.entries.delete(key);
            return undefined;
        }
        return entry;
    }

    async ttlMs(key: string) {
        const entry = this.live(key);
        return entry ? entry.expiresAt - this.now() : 0;
    }

    async getInt(key: string) {
        return this.live(key)?.value ?? 0;
    }

    async setIfAbsent(key: string, ttlMs: number) {
        if (this.live(key)) return false;
        this.entries.set(key, { value: 1, expiresAt: this.now() + ttlMs });
        return true;
    }

    async set(key: string, ttlMs: number) {
        this.entries.set(key, { value: 1, expiresAt: this.now() + ttlMs });
    }

    async incr(key: string, ttlMs: number) {
        const value = (this.live(key)?.value ?? 0) + 1;
        this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
        return value;
    }

    async del(...keys: string[]) {
        for (const key of keys) this.entries.delete(key);
    }
}

export class RedisBreakerKV implements BreakerKV {
    constructor(private readonly client: Redis) {}

    async ttlMs(key: string) {
        return this.client.pttl(key);
    }

    async getInt(key: string) {
        return Number(await this.client.get(key)) || 0;
    }

    async setIfAbsent(key: string, ttlMs: number) {
        return (await this.client.set(key, "1", "PX", ttlMs, "NX")) === "OK";
    }

    async set(key: string, ttlMs: number) {
        await this.client.set(key, "1", "PX", ttlMs);
    }

    async incr(key: string, ttlMs: number) {
        const results = await this.client.multi().incr(key).pexpire(key, ttlMs).exec();
        return Number(results?.[0]?.[1] ?? 0);
    }

    async del(...keys: string[]) {
        await this.client.del(...keys);
    }
}

const globalForBreakers = globalThis as unknown as {
    __edupilotBreakerMemoryKV?: MemoryBreakerKV;
    __edupilotBreakers?: Map<string, CircuitBreaker>;
};
const memoryKV = (globalForBreakers.__edupilotBreakerMemoryKV ??= new MemoryBreakerKV());

/** Redis si configuré et joignable (borné par son propre coupe-circuit), mémoire sinon. */
class SharedBreakerKV implements BreakerKV {
    private via<T>(operation: (kv: BreakerKV) => Promise<T>): Promise<T> {
        const client = getTcpRedis();
        if (!client) return operation(memoryKV);
        return tcpRedisCircuit.run(() => operation(new RedisBreakerKV(client)), () => operation(memoryKV));
    }

    ttlMs(key: string) { return this.via((kv) => kv.ttlMs(key)); }
    getInt(key: string) { return this.via((kv) => kv.getInt(key)); }
    setIfAbsent(key: string, ttlMs: number) { return this.via((kv) => kv.setIfAbsent(key, ttlMs)); }
    set(key: string, ttlMs: number) { return this.via((kv) => kv.set(key, ttlMs)); }
    incr(key: string, ttlMs: number) { return this.via((kv) => kv.incr(key, ttlMs)); }
    del(...keys: string[]) { return this.via((kv) => kv.del(...keys)); }
}

// ─── Coupe-circuit ────────────────────────────────────────────────────────────

export interface ExecuteOptions<T> {
    /** Réponse obtenue mais signe de panne (ex. HTTP 5xx). Défaut : jamais. */
    isFailureResult?: (result: T) => boolean;
    /**
     * Erreur levée qui compte comme une panne du service. Défaut : toutes.
     * Une erreur qui prouve que le service a répondu (refus 4xx) n'en est pas une.
     */
    isFailureError?: (error: unknown) => boolean;
}

export interface CircuitBreakerOptions {
    kv?: BreakerKV;
    settings?: () => CircuitSettings;
}

export class CircuitBreaker {
    private readonly kv: BreakerKV;
    private readonly settings: () => CircuitSettings;

    constructor(readonly name: string, options: CircuitBreakerOptions = {}) {
        this.kv = options.kv ?? new SharedBreakerKV();
        this.settings = options.settings ?? circuitSettings;
    }

    private key(part: "failures" | "open" | "probe") {
        return `cb:${this.name}:${part}`;
    }

    private transition(from: CircuitStateName, to: CircuitStateName, details: Record<string, unknown> = {}) {
        recordCircuitTransition(this.name, from, to);
        const message = `[circuit] ${this.name} : ${from} → ${to}`;
        const context = { module: "circuit-breaker", circuit: this.name, from, to, ...details };
        if (to === "open") logger.warn(message, context);
        else logger.info(message, context);
    }

    private reject(retryAfterMs: number): never {
        recordRejection("circuit_open");
        throw new CircuitOpenError(this.name, retryAfterMs);
    }

    /** État courant, pour la supervision. */
    async state(): Promise<CircuitStateName> {
        if ((await this.kv.ttlMs(this.key("open"))) > 0) return "open";
        const failures = await this.kv.getInt(this.key("failures"));
        return failures >= this.settings().failureThreshold ? "half_open" : "closed";
    }

    /**
     * Lève `CircuitOpenError` si le circuit est ouvert, sans rien tenter.
     * Utile avant un traitement qui avale les erreurs (envoi d'e-mail en tâche
     * de fond) : la tâche est différée au lieu de consommer une tentative.
     */
    async ensureAvailable(): Promise<void> {
        const openTtl = await this.kv.ttlMs(this.key("open"));
        if (openTtl > 0) this.reject(openTtl);
    }

    async execute<T>(operation: () => Promise<T>, options: ExecuteOptions<T> = {}): Promise<T> {
        const { failureThreshold, openMs } = this.settings();

        const openTtl = await this.kv.ttlMs(this.key("open"));
        if (openTtl > 0) this.reject(openTtl);

        const failures = await this.kv.getInt(this.key("failures"));
        const isProbe = failures >= failureThreshold;
        if (isProbe) {
            // Demi-ouvert : un seul essai à la fois, les autres attendent son verdict.
            if (!(await this.kv.setIfAbsent(this.key("probe"), openMs))) this.reject(PROBE_BUSY_RETRY_MS);
            this.transition("open", "half_open");
        }

        let result: T;
        try {
            result = await operation();
        } catch (error) {
            if (options.isFailureError?.(error) ?? true) await this.recordFailure(isProbe, error);
            else await this.recordSuccess(isProbe, failures);
            throw error;
        }
        if (options.isFailureResult?.(result)) await this.recordFailure(isProbe);
        else await this.recordSuccess(isProbe, failures);
        return result;
    }

    private async recordSuccess(wasProbe: boolean, failuresSeen: number) {
        if (failuresSeen === 0 && !wasProbe) return;
        await this.kv.del(this.key("failures"), this.key("probe"));
        if (wasProbe) this.transition("half_open", "closed");
    }

    private async recordFailure(wasProbe: boolean, error?: unknown) {
        const { failureThreshold, openMs } = this.settings();
        const failures = await this.kv.incr(this.key("failures"), Math.max(FAILURE_STREAK_TTL_MS, openMs * 2));
        if (failures < failureThreshold) return;
        await this.kv.set(this.key("open"), openMs);
        await this.kv.del(this.key("probe"));
        const reason = error instanceof Error ? error.message : undefined;
        // Un seul journal par ouverture, même si d'autres appels en vol échouent ensuite.
        if (wasProbe) this.transition("half_open", "open", { reason, openMs });
        else if (failures === failureThreshold) this.transition("closed", "open", { failures, reason, openMs });
    }
}

/** Coupe-circuit nommé, partagé par tout le processus. */
export function getCircuitBreaker(name: string): CircuitBreaker {
    const breakers = (globalForBreakers.__edupilotBreakers ??= new Map());
    let breaker = breakers.get(name);
    if (!breaker) {
        breaker = new CircuitBreaker(name);
        breakers.set(name, breaker);
    }
    return breaker;
}

/** Statut HTTP qui signale une panne du fournisseur (et non un refus de la requête). */
export function isProviderFailureStatus(status: number): boolean {
    return status >= 500 || status === 429;
}

/**
 * `fetch` protégé : 5xx, 429, délai dépassé et erreur réseau comptent comme
 * des échecs ; une réponse 2xx–4xx prouve que le fournisseur répond.
 */
export function circuitFetch(circuit: string, input: string | URL, init?: RequestInit): Promise<Response> {
    return getCircuitBreaker(circuit).execute(() => fetch(input, init), {
        isFailureResult: (response) => isProviderFailureStatus(response.status),
    });
}
