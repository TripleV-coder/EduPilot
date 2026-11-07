/**
 * État technique partagé entre instances, dans PostgreSQL — remplace Redis
 * (décision du 2026-11-07 : hébergement sans serveur, une seule dépendance).
 *
 * Deux tables UNLOGGED (aucune écriture dans le journal de PostgreSQL) :
 *  - `rate_limit_counters` : compteurs à durée de vie — fenêtres fixes des
 *    limites de débit, clés des coupe-circuits ;
 *  - `token_buckets` : seaux à jetons du débit général (fonction SQL
 *    `edupilot_sync_token_buckets`, par lot).
 *
 * Règles :
 *  - UNE instruction par opération, atomique (`INSERT … ON CONFLICT`), sur
 *    l'horloge du serveur PostgreSQL en UTC : identique pour toutes les
 *    instances, comme le `TIME` de Redis ;
 *  - client brut (`prismaBase`) : un aller-retour, pas de transaction RLS ;
 *  - les appelants passent par `storeCircuit` : base lente ou injoignable →
 *    repli mémoire immédiat, jamais d'attente répétée.
 */
import { prismaBase } from "@/lib/prisma";
import { StoreCircuit } from "@/lib/shared-state/circuit";
import { logger } from "@/lib/utils/logger";

// ─── Activation ──────────────────────────────────────────────────────────────

let enabledOverride: boolean | null = null;

/** Décidé au chargement : un test qui simule `NODE_ENV=production` ne bascule pas sur une vraie base. */
const ENABLED_BY_DEFAULT = process.env.NODE_ENV !== "test";

/**
 * Magasin partagé actif ? Toujours, sauf en tests unitaires (base simulée) :
 * les suites d'intégration l'activent avec `setSharedStoreEnabled(true)`.
 */
export function sharedStoreEnabled(): boolean {
    return enabledOverride ?? ENABLED_BY_DEFAULT;
}

/** Tests : force le magasin partagé (`true`), la mémoire (`false`) ou le défaut (`null`). */
export function setSharedStoreEnabled(value: boolean | null): void {
    enabledOverride = value;
}

/** Coupe-circuit unique du magasin partagé (limites, seaux, coupe-circuits). */
export const storeCircuit = new StoreCircuit({
    onDegraded: (error) =>
        logger.warn("[état partagé] PostgreSQL lent ou injoignable — limites et coupe-circuits en mémoire locale", {
            module: "shared-state",
            reason: error instanceof Error ? error.message : String(error),
        }),
    onRecovered: () => logger.info("[état partagé] PostgreSQL rétabli — limites de nouveau partagées", { module: "shared-state" }),
});

// ─── Nettoyage ───────────────────────────────────────────────────────────────

const SWEEP_EVERY_MS = 5 * 60_000;
let lastSweep = Date.now();

/**
 * Supprime les lignes mortes, au plus une fois par 5 min et par processus, en
 * arrière-plan (jamais sur le temps de la requête). Un seau inactif depuis
 * 15 min est plein (remplissage complet en une minute) : l'oublier ne change
 * rien.
 */
function maybeSweep(): void {
    const now = Date.now();
    if (now - lastSweep < SWEEP_EVERY_MS) return;
    lastSweep = now;
    void Promise.all([
        prismaBase.$executeRaw`DELETE FROM "rate_limit_counters" WHERE "resetAt" < (now() AT TIME ZONE 'UTC') - interval '1 minute'`,
        prismaBase.$executeRaw`DELETE FROM "token_buckets" WHERE "updatedAt" < (now() AT TIME ZONE 'UTC') - interval '15 minutes'`,
    ]).catch((error: unknown) => {
        logger.warn("[état partagé] nettoyage des compteurs expirés en échec", {
            module: "shared-state",
            reason: error instanceof Error ? error.message : String(error),
        });
    });
}

// ─── Compteurs à durée de vie ────────────────────────────────────────────────

export interface CounterState {
    count: number;
    /** Durée de vie restante, en ms (0 si expiré). */
    ttlMs: number;
}

/**
 * Fenêtre fixe : ajoute `by` au compteur ; si la fenêtre est expirée (ou la clé
 * absente), en ouvre une nouvelle de `windowMs` qui commence à `by`.
 */
export async function windowAdd(key: string, windowMs: number, by = 1): Promise<CounterState> {
    const rows = await prismaBase.$queryRaw<{ count: number; ttlMs: number }[]>`
        INSERT INTO "rate_limit_counters" AS c ("key", "count", "resetAt")
        VALUES (${key}::text, ${by}::int, (now() AT TIME ZONE 'UTC') + make_interval(secs => ${windowMs}::float8 / 1000))
        ON CONFLICT ("key") DO UPDATE SET
            "count" = CASE WHEN c."resetAt" <= (now() AT TIME ZONE 'UTC') THEN EXCLUDED."count" ELSE c."count" + EXCLUDED."count" END,
            "resetAt" = CASE WHEN c."resetAt" <= (now() AT TIME ZONE 'UTC') THEN EXCLUDED."resetAt" ELSE c."resetAt" END
        RETURNING "count"::int AS "count",
                  GREATEST(0, FLOOR(EXTRACT(EPOCH FROM ("resetAt" - (now() AT TIME ZONE 'UTC'))) * 1000))::int AS "ttlMs"`;
    maybeSweep();
    return rows[0] ?? { count: by, ttlMs: windowMs };
}

/**
 * Retire une unité d'un compteur encore vivant, sans toucher à sa fenêtre ;
 * la clé disparaît à zéro. Sans effet sur une clé absente ou expirée.
 */
export async function counterRelease(key: string): Promise<void> {
    // Deux branches exclusives sur le même instantané : la dernière unité
    // supprime la ligne, sinon on décrémente. (Une ligne modifiée par une
    // branche d'une instruction n'est pas visible des autres : d'où ce découpage.)
    await prismaBase.$executeRaw`
        WITH last_unit AS (
            DELETE FROM "rate_limit_counters"
             WHERE "key" = ${key}::text AND "resetAt" > (now() AT TIME ZONE 'UTC') AND "count" <= 1
        )
        UPDATE "rate_limit_counters" SET "count" = "count" - 1
         WHERE "key" = ${key}::text AND "resetAt" > (now() AT TIME ZONE 'UTC') AND "count" > 1`;
}

export async function counterDelete(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await prismaBase.$executeRaw`DELETE FROM "rate_limit_counters" WHERE "key" = ANY(${keys}::text[])`;
}

/** Valeur et durée de vie restante d'une clé vivante ({0, 0} sinon). */
export async function counterGet(key: string): Promise<CounterState> {
    const rows = await prismaBase.$queryRaw<{ count: number; ttlMs: number }[]>`
        SELECT "count"::int AS "count",
               GREATEST(1, FLOOR(EXTRACT(EPOCH FROM ("resetAt" - (now() AT TIME ZONE 'UTC'))) * 1000))::int AS "ttlMs"
          FROM "rate_limit_counters"
         WHERE "key" = ${key}::text AND "resetAt" > (now() AT TIME ZONE 'UTC')`;
    return rows[0] ?? { count: 0, ttlMs: 0 };
}

/** Pose la clé (valeur 1) si elle est absente ou expirée ; vrai si posée. */
export async function counterSetIfAbsent(key: string, ttlMs: number): Promise<boolean> {
    const rows = await prismaBase.$queryRaw<{ key: string }[]>`
        INSERT INTO "rate_limit_counters" AS c ("key", "count", "resetAt")
        VALUES (${key}::text, 1, (now() AT TIME ZONE 'UTC') + make_interval(secs => ${ttlMs}::float8 / 1000))
        ON CONFLICT ("key") DO UPDATE SET "count" = 1, "resetAt" = EXCLUDED."resetAt"
         WHERE c."resetAt" <= (now() AT TIME ZONE 'UTC')
        RETURNING "key"`;
    return rows.length > 0;
}

/** Pose la clé (valeur 1) pour `ttlMs`, qu'elle existe ou non. */
export async function counterSet(key: string, ttlMs: number): Promise<void> {
    await prismaBase.$executeRaw`
        INSERT INTO "rate_limit_counters" ("key", "count", "resetAt")
        VALUES (${key}::text, 1, (now() AT TIME ZONE 'UTC') + make_interval(secs => ${ttlMs}::float8 / 1000))
        ON CONFLICT ("key") DO UPDATE SET "count" = 1, "resetAt" = EXCLUDED."resetAt"`;
}

/** Incrémente et repousse l'expiration à `ttlMs` (INCR + PEXPIRE de Redis). */
export async function counterIncrRefresh(key: string, ttlMs: number): Promise<number> {
    const rows = await prismaBase.$queryRaw<{ count: number }[]>`
        INSERT INTO "rate_limit_counters" AS c ("key", "count", "resetAt")
        VALUES (${key}::text, 1, (now() AT TIME ZONE 'UTC') + make_interval(secs => ${ttlMs}::float8 / 1000))
        ON CONFLICT ("key") DO UPDATE SET
            "count" = CASE WHEN c."resetAt" <= (now() AT TIME ZONE 'UTC') THEN 1 ELSE c."count" + 1 END,
            "resetAt" = EXCLUDED."resetAt"
        RETURNING "count"::int AS "count"`;
    maybeSweep();
    return rows[0]?.count ?? 1;
}

// ─── Seaux à jetons ──────────────────────────────────────────────────────────

interface PendingSync {
    key: string;
    capacity: number;
    refillPerMs: number;
    pending: number;
    resolve: (level: number) => void;
    reject: (error: unknown) => void;
}

/** Au-delà, un lot est envoyé sans attendre (taille d'une requête bornée). */
const MAX_SYNC_BATCH = 500;
const queued: PendingSync[] = [];
let flushScheduled = false;

async function flushSyncs(): Promise<void> {
    flushScheduled = false;
    const batch = queued.splice(0, MAX_SYNC_BATCH);
    if (queued.length > 0) scheduleFlush();
    if (batch.length === 0) return;
    try {
        const rows = await prismaBase.$queryRaw<{ ord: number; level: number }[]>`
            SELECT "ord", "level" FROM edupilot_sync_token_buckets(
                ${batch.map((item) => item.key)}::text[],
                ${batch.map((item) => item.capacity)}::float8[],
                ${batch.map((item) => item.refillPerMs)}::float8[],
                ${batch.map((item) => item.pending)}::float8[])`;
        const levels = new Map(rows.map((row) => [Number(row.ord), Number(row.level)]));
        batch.forEach((item, index) => {
            const level = levels.get(index + 1);
            if (level === undefined) item.reject(new Error("edupilot_sync_token_buckets : seau absent du résultat"));
            else item.resolve(level);
        });
    } catch (error) {
        for (const item of batch) item.reject(error);
    }
    maybeSweep();
}

function scheduleFlush(): void {
    if (flushScheduled) return;
    flushScheduled = true;
    // Après les requêtes déjà arrivées dans ce tour de boucle : elles partagent le lot
    setImmediate(() => void flushSyncs());
}

/**
 * Inscrit `pending` jetons accordés localement et renvoie le niveau du seau
 * commun. Les synchronisations demandées dans un même tour de boucle partent
 * ensemble : UN aller-retour pour toutes (fonction SQL, verrous ordonnés).
 */
export function syncTokenBucket(key: string, capacity: number, refillPerMs: number, pending: number): Promise<{ level: number }> {
    return new Promise((resolve, reject) => {
        queued.push({ key, capacity, refillPerMs, pending, resolve: (level) => resolve({ level }), reject });
        if (queued.length >= MAX_SYNC_BATCH) void flushSyncs();
        else scheduleFlush();
    });
}
