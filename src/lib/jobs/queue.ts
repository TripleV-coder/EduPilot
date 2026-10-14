/**
 * File de tâches de fond durable, adossée à PostgreSQL (table `background_jobs`).
 *
 * Pourquoi pas `after()` seul : une tâche lancée après la réponse est perdue
 * si le processus redémarre, et n'est jamais retentée si le fournisseur
 * (SMTP, passerelle SMS) est momentanément indisponible. Pourquoi pas Redis :
 * décision du 2026-09-12, l'installation n'en dépend pas ; la base est déjà là
 * et sauvegardée.
 *
 * - `enqueueJobs` : une seule insertion atomique, la requête HTTP rend la main.
 * - Le processeur prend les tâches par `FOR UPDATE SKIP LOCKED` : plusieurs
 *   processus peuvent tourner sans jamais prendre la même tâche.
 * - Échec : nouvel essai avec attente croissante (30 s, 1 min, 2 min…, 1 h max),
 *   puis FAILED après `maxAttempts`. `PermanentJobError` passe directement à FAILED.
 * - Processus arrêté en pleine tâche : la tâche RUNNING est reprise après
 *   STALE_LOCK_SECONDS.
 * - Les tâches terminées sont purgées (elles contiennent des coordonnées).
 * - File bornée (`JOB_QUEUE_MAX`) : au-delà du seuil de refus (80 %), ou si le
 *   lot ne tient plus, `enqueueJobs` lève `QueueSaturatedError` (503 Retry-After).
 * - Débit contrôlé : `JOB_WORKER_RATE_PER_MIN` envois par minute, tous
 *   processeurs confondus (seau partagé par Redis), `JOB_WORKER_CONCURRENCY` en parallèle.
 * - Fournisseur coupé (`CircuitOpenError`) : la tâche est différée jusqu'à la
 *   réouverture du circuit, sans consommer de tentative.
 */
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { runAsSystem, runWithDbContext, tenantContext, type DbContext } from "@/lib/db/db-context";
import { logger } from "@/lib/utils/logger";
import { queueSettings } from "@/lib/resilience/config";
import { CircuitOpenError, QueueSaturatedError } from "@/lib/resilience/errors";
import { recordRejection } from "@/lib/resilience/metrics";
import { perMinute, takeTokens } from "@/lib/resilience/token-bucket";
import type { JobHandlers, JobType, NewJob } from "./types";

/** Échec qu'un nouvel essai ne corrigera pas (fournisseur absent, numéro refusé). */
export class PermanentJobError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PermanentJobError";
    }
}

export const DEFAULT_MAX_ATTEMPTS = 5;
const ENQUEUE_CHUNK = 1_000;
const CLAIM_BATCH = 20;
const JOB_TIMEOUT_MS = 60_000;
/** Plus long qu'un lot complet (CLAIM_BATCH / concurrence par défaut 5 × JOB_TIMEOUT_MS = 4 min). */
const STALE_LOCK_SECONDS = 10 * 60;
const POLL_MS = 5_000;
const BACKOFF_BASE_MS = 30_000;
const BACKOFF_MAX_MS = 60 * 60_000;
const MAX_ERROR_LENGTH = 1_000;
const DONE_RETENTION_MS = 7 * 24 * 60 * 60_000;
const FAILED_RETENTION_MS = 30 * 24 * 60 * 60_000;
const PURGE_EVERY_MS = 60 * 60_000;

export interface ProcessJobsResult {
    done: number;
    retried: number;
    failed: number;
    /** Tâches remises à plus tard, fournisseur coupé (tentative non comptée). */
    deferred: number;
    /** Des tâches prêtes restaient quand `maxJobs` a été atteint. */
    hasMore: boolean;
    /** Débit maximal atteint : délai avant le prochain envoi autorisé, 0 sinon. */
    throttledMs: number;
}

/** Envois en attente ou en cours, tous établissements confondus. */
async function countBacklog(): Promise<number> {
    return runAsSystem("jobs:backpressure", () =>
        prisma.backgroundJob.count({ where: { status: { in: ["PENDING", "RUNNING"] } } }),
    );
}

/**
 * Refuse un lot quand la file est saturée (seuil de refus atteint) ou quand il
 * ne tient plus dans la capacité restante. Délai conseillé : le temps
 * d'écouler l'excédent au débit configuré, entre 30 s et 15 min.
 */
async function assertQueueCapacity(incoming: number): Promise<void> {
    const { maxSize, rejectRatio, ratePerMinute } = queueSettings();
    const backlog = await countBacklog();
    const rejectAt = Math.floor(maxSize * rejectRatio);
    const reason = backlog >= rejectAt ? "saturated" : backlog + incoming > maxSize ? "full" : null;
    if (!reason) return;

    const excess = Math.max(1, backlog + incoming - rejectAt);
    const retryAfterMs = Math.min(15 * 60_000, Math.max(30_000, (excess / ratePerMinute) * 60_000));
    recordRejection(reason === "full" ? "queue_full" : "queue_saturated");
    logger.warn("File d'envoi : lot refusé", { module: "jobs", reason, backlog, incoming, maxSize, rejectAt });
    throw new QueueSaturatedError(reason, retryAfterMs);
}

interface ClaimedJob {
    id: string;
    type: string;
    payload: unknown;
    schoolId: string | null;
    attempts: number;
    maxAttempts: number;
}

/** Délai avant le n-ième nouvel essai (n ≥ 1). */
export function retryDelayMs(attempts: number): number {
    return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** Math.max(0, attempts - 1));
}

/**
 * Enfile des tâches en une transaction (tout ou rien) et réveille le processeur.
 * Appelé dans le contexte de la requête : la RLS refuse une tâche rattachée à
 * un établissement hors du périmètre de l'utilisateur.
 */
export async function enqueueJobs(jobs: readonly NewJob[]): Promise<number> {
    if (jobs.length === 0) return 0;
    await assertQueueCapacity(jobs.length);
    const rows = jobs.map((job) => ({
        type: job.type,
        payload: job.payload as unknown as Prisma.InputJsonValue,
        schoolId: job.schoolId ?? null,
        runAt: job.runAt ?? new Date(),
        maxAttempts: job.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    }));
    const chunks: (typeof rows)[] = [];
    for (let i = 0; i < rows.length; i += ENQUEUE_CHUNK) chunks.push(rows.slice(i, i + ENQUEUE_CHUNK));

    const results = await prisma.$transaction(chunks.map((data) => prisma.backgroundJob.createMany({ data })));
    wakeJobWorker();
    return results.reduce((sum, result) => sum + result.count, 0);
}

/**
 * Horloges en UTC sans fuseau, comme les colonnes écrites par Prisma : `NOW()`
 * seul serait converti selon le fuseau de la session PostgreSQL.
 */
async function claimJobs(limit: number): Promise<ClaimedJob[]> {
    return prisma.$queryRaw<ClaimedJob[]>`
        UPDATE "background_jobs"
           SET "status" = 'RUNNING', "lockedAt" = (NOW() AT TIME ZONE 'UTC'), "attempts" = "attempts" + 1
         WHERE "id" IN (
            SELECT "id" FROM "background_jobs"
             WHERE ("status" = 'PENDING' AND "runAt" <= (NOW() AT TIME ZONE 'UTC'))
                OR ("status" = 'RUNNING' AND "lockedAt" < (NOW() AT TIME ZONE 'UTC') - make_interval(secs => ${STALE_LOCK_SECONDS}))
             ORDER BY "runAt"
             LIMIT ${limit}
             FOR UPDATE SKIP LOCKED)
        RETURNING "id", "type", "payload", "schoolId", "attempts", "maxAttempts"`;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Tâche interrompue après ${ms / 1000} s`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function errorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return message.slice(0, MAX_ERROR_LENGTH);
}

async function markFailed(job: ClaimedJob, reason: string) {
    await prisma.backgroundJob.update({
        where: { id: job.id },
        data: { status: "FAILED", lockedAt: null, lastError: reason, completedAt: new Date() },
    });
    logger.error("Tâche de fond abandonnée", undefined, { module: "jobs", jobId: job.id, type: job.type, attempts: job.attempts, reason });
}

async function runJob(job: ClaimedJob, handlers: JobHandlers): Promise<"done" | "retried" | "failed" | "deferred"> {
    const handler = handlers[job.type as JobType] as ((payload: unknown) => Promise<void>) | undefined;
    if (!handler) {
        await markFailed(job, `Type de tâche inconnu : ${job.type}`);
        return "failed";
    }
    // Reprise d'une tâche dont le processus est mort après sa dernière tentative.
    if (job.attempts > job.maxAttempts) {
        await markFailed(job, "Nombre maximal de tentatives atteint");
        return "failed";
    }

    const context: DbContext = job.schoolId ? tenantContext([job.schoolId]) : { kind: "system", reason: `job:${job.type}` };
    try {
        await withTimeout(runWithDbContext(context, () => handler(job.payload)), JOB_TIMEOUT_MS);
        await prisma.backgroundJob.update({
            where: { id: job.id },
            data: { status: "DONE", lockedAt: null, lastError: null, completedAt: new Date() },
        });
        return "done";
    } catch (error) {
        const reason = errorMessage(error);
        if (error instanceof CircuitOpenError) {
            // Aucun appel n'a été tenté : la tentative prise à la réservation est rendue.
            await prisma.backgroundJob.update({
                where: { id: job.id },
                data: {
                    status: "PENDING",
                    lockedAt: null,
                    attempts: { decrement: 1 },
                    lastError: reason,
                    runAt: new Date(Date.now() + error.retryAfterMs),
                },
            });
            return "deferred";
        }
        if (error instanceof PermanentJobError || job.attempts >= job.maxAttempts) {
            await markFailed(job, reason);
            return "failed";
        }
        await prisma.backgroundJob.update({
            where: { id: job.id },
            data: { status: "PENDING", lockedAt: null, lastError: reason, runAt: new Date(Date.now() + retryDelayMs(job.attempts)) },
        });
        logger.warn("Tâche de fond en échec, nouvel essai programmé", { module: "jobs", jobId: job.id, type: job.type, attempts: job.attempts, reason });
        return "retried";
    }
}

async function forEachWithConcurrency<T>(items: readonly T[], limit: number, task: (item: T) => Promise<void>) {
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const item = items[next++];
            await task(item);
        }
    });
    await Promise.all(workers);
}

/** Traite les tâches prêtes, au plus `maxJobs`. Sûr en concurrence avec d'autres processus. */
export async function processJobs(options: { maxJobs?: number; handlers?: JobHandlers } = {}): Promise<ProcessJobsResult> {
    const handlers = options.handlers ?? (await import("./handlers")).JOB_HANDLERS;
    const maxJobs = options.maxJobs ?? 500;

    const { concurrency, ratePerMinute } = queueSettings();
    const budget = perMinute("jobs:worker", ratePerMinute);

    return runAsSystem("jobs:processor", async () => {
        const result: ProcessJobsResult = { done: 0, retried: 0, failed: 0, deferred: 0, hasMore: false, throttledMs: 0 };
        let handled = 0;
        while (handled < maxJobs) {
            if (worker.stopping) return result;
            // Débit commun à tous les processeurs : on ne réserve que ce que le seau accorde.
            const permit = await takeTokens(budget, Math.min(CLAIM_BATCH, maxJobs - handled));
            if (permit.granted === 0) {
                result.throttledMs = permit.retryAfterMs;
                return result;
            }
            const jobs = await claimJobs(permit.granted);
            if (jobs.length === 0) return result;
            handled += jobs.length;
            await forEachWithConcurrency(jobs, concurrency, async (job) => {
                result[await runJob(job, handlers)] += 1;
            });
        }
        result.hasMore = true;
        return result;
    });
}

/** Supprime les tâches terminées depuis 7 jours et abandonnées depuis 30 jours. */
export async function purgeFinishedJobs(now = new Date()): Promise<number> {
    return runAsSystem("jobs:purge", async () => {
        const { count } = await prisma.backgroundJob.deleteMany({
            where: {
                OR: [
                    { status: "DONE", completedAt: { lt: new Date(now.getTime() - DONE_RETENTION_MS) } },
                    { status: "FAILED", completedAt: { lt: new Date(now.getTime() - FAILED_RETENTION_MS) } },
                ],
            },
        });
        return count;
    });
}

/** État de la file pour la supervision. */
export async function getJobQueueStats() {
    return runAsSystem("jobs:stats", async () => {
        const [byStatus, oldestPending] = await Promise.all([
            prisma.backgroundJob.groupBy({ by: ["status"], _count: { _all: true } }),
            prisma.backgroundJob.findFirst({ where: { status: "PENDING" }, orderBy: { runAt: "asc" }, select: { runAt: true } }),
        ]);
        const counts = { PENDING: 0, RUNNING: 0, DONE: 0, FAILED: 0 };
        for (const row of byStatus) counts[row.status] = row._count._all;
        return { ...counts, oldestPendingRunAt: oldestPending?.runAt ?? null };
    });
}

// ─── Processeur intégré au serveur ────────────────────────────────────────────

/** Attente maximale du passage en cours à l'arrêt (chaque tâche d'arrêt dispose de 5 s). */
const STOP_WAIT_MS = 3_000;

const worker = {
    started: false,
    stopping: false,
    timer: null as ReturnType<typeof setTimeout> | null,
    running: null as Promise<void> | null,
    wakeRequested: false,
    lastPurge: 0,
};

function schedule(delayMs: number) {
    if (!worker.started) return;
    if (worker.timer) clearTimeout(worker.timer);
    worker.timer = setTimeout(tick, delayMs);
    worker.timer.unref?.();
}

async function tick() {
    worker.timer = null;
    let again = false;
    let throttledMs = 0;
    worker.running = (async () => {
        try {
            const result = await processJobs();
            again = result.hasMore;
            throttledMs = result.throttledMs;
            if (result.done + result.retried + result.failed + result.deferred > 0) {
                logger.info("Tâches de fond traitées", { module: "jobs", ...result });
            }
            if (Date.now() - worker.lastPurge > PURGE_EVERY_MS) {
                worker.lastPurge = Date.now();
                const purged = await purgeFinishedJobs();
                if (purged > 0) logger.info("Tâches de fond terminées purgées", { module: "jobs", purged });
            }
        } catch (error) {
            logger.error("Processeur de tâches de fond en échec", error as Error, { module: "jobs" });
        }
    })();
    await worker.running;
    worker.running = null;
    const wake = worker.wakeRequested;
    worker.wakeRequested = false;
    // Débit atteint : reprendre au prochain jeton, même si de nouvelles tâches arrivent.
    if (throttledMs > 0) schedule(Math.min(throttledMs, POLL_MS));
    else schedule(again || wake ? 0 : POLL_MS);
}

/** Démarre le processeur du serveur (idempotent). Interroge la file toutes les 5 s. */
export function startJobWorker(): void {
    if (worker.started) return;
    worker.started = true;
    worker.stopping = false;
    schedule(0);
}

/** Traite sans attendre le prochain passage les tâches qui viennent d'être enfilées. */
export function wakeJobWorker(): void {
    if (!worker.started) return;
    if (worker.running) {
        worker.wakeRequested = true;
        return;
    }
    schedule(0);
}

/**
 * Arrêt propre : plus de nouveau lot ; le lot en cours a quelques secondes pour
 * finir. Une tâche coupée reste RUNNING et sera reprise après STALE_LOCK_SECONDS.
 */
export async function stopJobWorker(): Promise<void> {
    worker.started = false;
    worker.stopping = true;
    if (worker.timer) clearTimeout(worker.timer);
    worker.timer = null;
    if (!worker.running) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
        worker.running,
        new Promise<void>((resolve) => {
            timer = setTimeout(resolve, STOP_WAIT_MS);
        }),
    ]);
    clearTimeout(timer);
}
