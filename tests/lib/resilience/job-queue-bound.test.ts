import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * File d'envoi bornée : refus (503) dès que le seuil de 80 % est atteint, ou
 * immédiatement si le lot ne tient plus ; rien n'est inséré dans ces cas.
 * Le comportement contre une vraie base est couvert par
 * tests/integration-db/job-queue.test.ts.
 */
const { countMock, createManyMock, transactionMock } = vi.hoisted(() => ({
    countMock: vi.fn(),
    createManyMock: vi.fn(),
    transactionMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
    default: {
        backgroundJob: { count: countMock, createMany: createManyMock },
        $transaction: transactionMock,
    },
}));
vi.mock("@/lib/db/db-context", () => ({
    runAsSystem: (_reason: string, fn: () => unknown) => fn(),
    runWithDbContext: (_ctx: unknown, fn: () => unknown) => fn(),
    tenantContext: () => undefined,
}));

import { enqueueJobs } from "@/lib/jobs/queue";
import { QueueSaturatedError } from "@/lib/resilience/errors";
import { renderPrometheus, resetMetrics } from "@/lib/resilience/metrics";
import type { NewJob } from "@/lib/jobs/types";

const job = (i: number): NewJob => ({
    type: "email.send",
    payload: { to: `p${i}@ecole.bj`, subject: "Objet", html: "<p>Bonjour</p>" },
});
const batch = (n: number) => Array.from({ length: n }, (_, i) => job(i));

beforeEach(() => {
    vi.clearAllMocks();
    resetMetrics();
    vi.stubEnv("JOB_QUEUE_MAX", "1000");
    vi.stubEnv("JOB_QUEUE_REJECT_RATIO", "0.8");
    vi.stubEnv("JOB_WORKER_RATE_PER_MIN", "600");
    createManyMock.mockImplementation(({ data }: { data: unknown[] }) => ({ count: data.length }));
    transactionMock.mockImplementation(async (operations: unknown[]) => Promise.all(operations));
});

afterEach(() => {
    vi.unstubAllEnvs();
});

async function rejection(promise: Promise<unknown>): Promise<QueueSaturatedError> {
    const error = await promise.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(QueueSaturatedError);
    return error as QueueSaturatedError;
}

describe("file d'envoi bornée", () => {
    it("accepte un lot sous le seuil de refus", async () => {
        countMock.mockResolvedValue(100);
        expect(await enqueueJobs(batch(50))).toBe(50);
        expect(countMock).toHaveBeenCalledWith({ where: { status: { in: ["PENDING", "RUNNING"] } } });
    });

    it("refuse dès 80 % de la capacité (QUEUE_SATURATED), sans rien insérer", async () => {
        countMock.mockResolvedValue(800);
        const error = await rejection(enqueueJobs(batch(1)));
        expect(error.code).toBe("QUEUE_SATURATED");
        expect(transactionMock).not.toHaveBeenCalled();
    });

    it("refuse immédiatement un lot qui ferait déborder la file (QUEUE_FULL)", async () => {
        countMock.mockResolvedValue(500);
        const error = await rejection(enqueueJobs(batch(600)));
        expect(error.code).toBe("QUEUE_FULL");
        expect(transactionMock).not.toHaveBeenCalled();
    });

    it("conseille d'attendre le temps d'écouler l'excédent, entre 30 s et 15 min", async () => {
        countMock.mockResolvedValue(800);
        expect((await rejection(enqueueJobs(batch(1)))).retryAfterMs).toBe(30_000);

        vi.stubEnv("JOB_WORKER_RATE_PER_MIN", "1");
        countMock.mockResolvedValue(999);
        expect((await rejection(enqueueJobs(batch(1)))).retryAfterMs).toBe(15 * 60_000);
    });

    it("compte les refus par motif", async () => {
        countMock.mockResolvedValueOnce(800).mockResolvedValueOnce(500);
        await enqueueJobs(batch(1)).catch(() => undefined);
        await enqueueJobs(batch(600)).catch(() => undefined);
        const text = renderPrometheus({ queue: null, circuits: [] });
        expect(text).toContain('edupilot_requests_rejected_total{reason="queue_saturated"} 1');
        expect(text).toContain('edupilot_requests_rejected_total{reason="queue_full"} 1');
    });

    it("un lot vide ne consulte même pas la file", async () => {
        expect(await enqueueJobs([])).toBe(0);
        expect(countMock).not.toHaveBeenCalled();
    });
});
