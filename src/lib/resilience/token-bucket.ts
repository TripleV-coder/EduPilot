/**
 * Seaux à jetons (token bucket) partagés entre instances.
 *
 * Un seau contient au plus `capacity` jetons et se remplit en continu de
 * `refillPerMs` jetons par milliseconde. Une requête prend un jeton ; seau vide
 * ⇒ refus, avec le délai exact avant le prochain jeton (en-tête Retry-After).
 * Contrairement à une fenêtre fixe, une rafale en début de minute n'est pas
 * suivie d'un blocage net : le débit revient progressivement.
 *
 * Plusieurs seaux sont vérifiés ensemble (compte ET adresse IP) : si l'un est
 * vide, AUCUN n'est débité — un enseignant bloqué par son quota personnel ne
 * consomme pas celui de son école.
 *
 * Stockage (2026-11-07, Redis retiré) — PostgreSQL, sans aller-retour par
 * requête (`SharedTokenBuckets`) :
 *  - chaque processus décide LOCALEMENT, sur le dernier niveau connu du seau
 *    partagé, remis à jour par le remplissage ;
 *  - il synchronise (`edupilot_sync_token_buckets`) quand ce niveau a
 *    plus de 2 s, ou dès qu'il a accordé 5 % du quota depuis la dernière
 *    synchronisation : la consommation accordée entre-temps est alors inscrite
 *    dans le seau commun. Les synchronisations simultanées partent en UN lot
 *    (fonction SQL `edupilot_sync_token_buckets`) ;
 *  - un refus décidé sur un niveau récent ne touche pas la base : une rafale
 *    contre un seau vide ne coûte rien.
 * Écart borné : au pire, chaque processus accorde 5 % du quota de trop par
 * période de 2 s ; jamais de refus à tort. Avec Redis, c'était un aller-retour
 * réseau par requête API.
 * Base lente ou injoignable → coupe-circuit, même algorithme en mémoire.
 */
import { sharedStoreEnabled, storeCircuit, syncTokenBucket } from "@/lib/shared-state/pg";

export interface BucketSpec {
    key: string;
    capacity: number;
    refillPerMs: number;
}

export interface ConsumeResult {
    allowed: boolean;
    /** Jetons restants dans le seau le plus bas (après débit). */
    remaining: number;
    /** Délai avant qu'une nouvelle requête passe, 0 si autorisée. */
    retryAfterMs: number;
    /** Index du premier seau vide dans la liste fournie, -1 si autorisée. */
    deniedIndex: number;
}

export interface TakeResult {
    /** Jetons accordés (0 à `wanted`). */
    granted: number;
    /** Délai avant le prochain jeton, 0 si au moins un a été accordé. */
    retryAfterMs: number;
}

/** Seau de `perMinute` jetons rempli en une minute : la rafale maximale vaut le quota. */
export function perMinute(key: string, perMinuteCount: number): BucketSpec {
    return { key, capacity: perMinuteCount, refillPerMs: perMinuteCount / 60_000 };
}

// ─── Algorithme (mémoire du processus : repli et tests) ──────────────────────

interface BucketState {
    tokens: number;
    ts: number;
}

function refill(state: BucketState | undefined, spec: BucketSpec, now: number): number {
    if (!state) return spec.capacity;
    return Math.min(spec.capacity, state.tokens + Math.max(0, now - state.ts) * spec.refillPerMs);
}

/** Seaux en mémoire ; horloge injectable pour les tests. */
export class MemoryTokenBuckets {
    private readonly buckets = new Map<string, BucketState>();

    constructor(private readonly now: () => number = Date.now) {}

    consume(specs: readonly BucketSpec[], cost = 1): ConsumeResult {
        const now = this.now();
        const levels = specs.map((spec) => refill(this.buckets.get(spec.key), spec, now));
        let deniedIndex = -1;
        let retryAfterMs = 0;
        levels.forEach((tokens, i) => {
            if (tokens >= cost) return;
            if (deniedIndex === -1) deniedIndex = i;
            retryAfterMs = Math.max(retryAfterMs, Math.ceil((cost - tokens) / specs[i].refillPerMs));
        });
        const allowed = deniedIndex === -1;
        let remaining = Infinity;
        specs.forEach((spec, i) => {
            const tokens = allowed ? levels[i] - cost : levels[i];
            this.buckets.set(spec.key, { tokens, ts: now });
            remaining = Math.min(remaining, Math.floor(tokens));
        });
        this.sweep(now);
        return { allowed, remaining: remaining === Infinity ? 0 : remaining, retryAfterMs, deniedIndex };
    }

    takeUpTo(spec: BucketSpec, wanted: number): TakeResult {
        const now = this.now();
        const tokens = refill(this.buckets.get(spec.key), spec, now);
        const granted = Math.max(0, Math.min(wanted, Math.floor(tokens)));
        const left = tokens - granted;
        this.buckets.set(spec.key, { tokens: left, ts: now });
        return { granted, retryAfterMs: granted > 0 ? 0 : Math.ceil((1 - left) / spec.refillPerMs) };
    }

    private lastSweep = 0;

    /** Oublie les seaux pleins depuis longtemps : la mémoire ne grossit pas avec le nombre de visiteurs. */
    private sweep(now: number): void {
        if (now - this.lastSweep < 60_000) return;
        this.lastSweep = now;
        for (const [key, state] of this.buckets) {
            if (now - state.ts > 10 * 60_000) this.buckets.delete(key);
        }
    }
}

// ─── Magasin partagé (PostgreSQL) ─────────────────────────────────────────────

/** Âge maximal du niveau connu avant une nouvelle synchronisation. */
export const SYNC_INTERVAL_MS = 2_000;
/** Part du quota accordée localement avant d'inscrire la consommation. */
export const SYNC_BATCH_RATIO = 0.05;

/** Inscrit `pending` jetons et renvoie le niveau du seau commun (synchronisation par lot). */
export type DebitFn = (spec: BucketSpec, pending: number) => Promise<{ level: number }>;

interface LocalView {
    /** Niveau du seau commun lors de la dernière synchronisation (peut être < 0). */
    level: number;
    syncedAt: number;
    /** Jetons accordés ici depuis, pas encore inscrits dans le seau commun. */
    pending: number;
    inflight?: Promise<void>;
}

export class SharedTokenBuckets {
    private readonly views = new Map<string, LocalView>();
    private lastSweep = 0;

    constructor(
        private readonly debit: DebitFn,
        private readonly now: () => number = Date.now,
    ) {}

    private batch(spec: BucketSpec): number {
        return Math.max(1, Math.floor(spec.capacity * SYNC_BATCH_RATIO));
    }

    /** Niveau estimé maintenant : dernier niveau connu + remplissage − consommation locale. */
    private estimate(view: LocalView, spec: BucketSpec, now: number): number {
        return Math.min(spec.capacity, view.level + Math.max(0, now - view.syncedAt) * spec.refillPerMs) - view.pending;
    }

    private fresh(view: LocalView | undefined, now: number): view is LocalView {
        return view !== undefined && now - view.syncedAt < SYNC_INTERVAL_MS;
    }

    /**
     * Inscrit la consommation locale et relit le niveau commun. Les appels
     * simultanés sur un même seau partagent la même synchronisation.
     */
    private async sync(spec: BucketSpec): Promise<LocalView> {
        let view = this.views.get(spec.key);
        if (!view) {
            view = { level: spec.capacity, syncedAt: -Infinity, pending: 0 };
            this.views.set(spec.key, view);
        }
        if (!view.inflight) {
            const target = view;
            const flushed = target.pending;
            target.inflight = this.debit(spec, flushed)
                .then(({ level }) => {
                    target.level = level;
                    target.syncedAt = this.now();
                    target.pending -= flushed;
                })
                .finally(() => {
                    target.inflight = undefined;
                });
        }
        await view.inflight;
        return view;
    }

    /**
     * Seau jamais vu par ce processus : admis sur un seau plein, dans la limite
     * d'un lot, pendant que sa première synchronisation part en arrière-plan —
     * la première requête d'un compte n'attend pas la base (même écart borné :
     * un lot par processus).
     */
    private adoptUnseen(spec: BucketSpec, now: number): void {
        if (this.views.has(spec.key)) return;
        this.views.set(spec.key, { level: spec.capacity, syncedAt: now, pending: 0 });
        this.sync(spec).catch(() => {
            // Base injoignable : le niveau vieillira et la prochaine requête
            // passera par le coupe-circuit du magasin (repli mémoire).
        });
    }

    async consume(specs: readonly BucketSpec[], cost = 1): Promise<ConsumeResult> {
        let now = this.now();
        for (const spec of specs) this.adoptUnseen(spec, now);
        const stale = specs.filter((spec) => {
            const view = this.views.get(spec.key);
            return !this.fresh(view, now) || view.pending + cost > this.batch(spec);
        });
        if (stale.length > 0) {
            await Promise.all(stale.map((spec) => this.sync(spec)));
            now = this.now();
        }

        const views = specs.map((spec) => this.views.get(spec.key) as LocalView);
        const levels = specs.map((spec, i) => this.estimate(views[i], spec, now));
        let deniedIndex = -1;
        let retryAfterMs = 0;
        levels.forEach((tokens, i) => {
            if (tokens >= cost) return;
            if (deniedIndex === -1) deniedIndex = i;
            retryAfterMs = Math.max(retryAfterMs, Math.ceil((cost - tokens) / specs[i].refillPerMs));
        });
        const allowed = deniedIndex === -1;
        if (allowed) for (const view of views) view.pending += cost;
        const remaining = Math.min(...levels.map((tokens) => Math.floor(allowed ? tokens - cost : tokens)));
        this.sweep(now);
        return { allowed, remaining: Math.max(0, remaining), retryAfterMs, deniedIndex };
    }

    /** Prend jusqu'à `wanted` jetons sur un niveau frais, et l'inscrit aussitôt. */
    async takeUpTo(spec: BucketSpec, wanted: number): Promise<TakeResult> {
        const view = await this.sync(spec);
        const tokens = this.estimate(view, spec, this.now());
        const granted = Math.max(0, Math.min(wanted, Math.floor(tokens)));
        if (granted === 0) return { granted, retryAfterMs: Math.ceil((1 - tokens) / spec.refillPerMs) };
        view.pending += granted;
        await this.sync(spec);
        return { granted, retryAfterMs: 0 };
    }

    /** Oublie les seaux sans activité depuis 10 min. */
    private sweep(now: number): void {
        if (now - this.lastSweep < 60_000) return;
        this.lastSweep = now;
        for (const [key, view] of this.views) {
            if (!view.inflight && now - view.syncedAt > 10 * 60_000) this.views.delete(key);
        }
    }
}

// ─── API ──────────────────────────────────────────────────────────────────────

const globalForBuckets = globalThis as unknown as {
    __edupilotMemoryBuckets?: MemoryTokenBuckets;
    __edupilotSharedBuckets?: SharedTokenBuckets;
};
const memoryBuckets = (globalForBuckets.__edupilotMemoryBuckets ??= new MemoryTokenBuckets());
const sharedBuckets = (globalForBuckets.__edupilotSharedBuckets ??= new SharedTokenBuckets((spec, pending) =>
    syncTokenBucket(spec.key, spec.capacity, spec.refillPerMs, pending),
));

/** Débite `cost` jetons de chaque seau, ou d'aucun si l'un est vide. */
export async function consumeTokens(specs: readonly BucketSpec[], cost = 1): Promise<ConsumeResult> {
    if (!sharedStoreEnabled()) return memoryBuckets.consume(specs, cost);
    return storeCircuit.run(
        () => sharedBuckets.consume(specs, cost),
        () => memoryBuckets.consume(specs, cost),
    );
}

/** Prend jusqu'à `wanted` jetons (autant que le seau en contient). */
export async function takeTokens(spec: BucketSpec, wanted: number): Promise<TakeResult> {
    if (!sharedStoreEnabled()) return memoryBuckets.takeUpTo(spec, wanted);
    return storeCircuit.run(
        () => sharedBuckets.takeUpTo(spec, wanted),
        () => memoryBuckets.takeUpTo(spec, wanted),
    );
}
