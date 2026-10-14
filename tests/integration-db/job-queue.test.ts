import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import prisma from "@/lib/prisma";
import { runAsSystem, runWithDbContext, tenantContext } from "@/lib/db/db-context";
import { enqueueJobs, PermanentJobError, processJobs, purgeFinishedJobs } from "@/lib/jobs/queue";
import type { JobHandlers, NewJob } from "@/lib/jobs/types";
import { CircuitOpenError, QueueSaturatedError } from "@/lib/resilience/errors";
import ownerDb from "./owner-db";
import { createSchool } from "./helpers";

/**
 * File d'envoi durable (e-mails, SMS) contre une vraie base : prise exclusive
 * par SKIP LOCKED, nouvel essai puis abandon, reprise après un arrêt brutal,
 * isolation RLS par établissement et purge. Seuls les envois sont simulés.
 */
let schoolA: string;
let schoolB: string;

const email = (to: string, schoolId: string | null = null): NewJob => ({
  type: "email.send",
  schoolId,
  payload: { to, subject: "Objet", html: "<p>Bonjour</p>" },
});

function handlers(email: JobHandlers["email.send"] = async () => {}): JobHandlers {
  return { "email.send": email, "sms.send": async () => {} };
}

const enqueueAsSystem = (jobs: NewJob[]) => runAsSystem("test:enqueue", () => enqueueJobs(jobs));

beforeAll(async () => {
  schoolA = (await createSchool("JQA")).id;
  schoolB = (await createSchool("JQB")).id;
});

beforeEach(async () => {
  await ownerDb.backgroundJob.deleteMany({});
});

describe("file de tâches de fond", () => {
  it("chaque tâche n'est traitée qu'une fois, même par des processeurs simultanés", async () => {
    await enqueueAsSystem(Array.from({ length: 60 }, (_, i) => email(`p${i}@ecole.bj`)));
    const seen: string[] = [];
    const handle = handlers(async (payload) => {
      seen.push(payload.to);
    });

    const results = await Promise.all([1, 2, 3].map(() => processJobs({ handlers: handle })));

    expect(results.reduce((sum, r) => sum + r.done, 0)).toBe(60);
    expect(seen).toHaveLength(60);
    expect(new Set(seen).size).toBe(60);
    expect(await ownerDb.backgroundJob.count({ where: { status: "DONE" } })).toBe(60);
  });

  it("un échec passager est retenté plus tard, puis abandonné après le maximum de tentatives", async () => {
    await runAsSystem("test:enqueue", () => enqueueJobs([{ ...email("a@ecole.bj"), maxAttempts: 2 }]));
    const failing = handlers(async () => {
      throw new Error("SMTP indisponible");
    });

    expect(await processJobs({ handlers: failing })).toMatchObject({ retried: 1, failed: 0 });
    let job = await ownerDb.backgroundJob.findFirstOrThrow();
    expect(job).toMatchObject({ status: "PENDING", attempts: 1, lastError: "SMTP indisponible", lockedAt: null });
    expect(job.runAt.getTime()).toBeGreaterThan(Date.now());

    // Pas encore l'heure du nouvel essai.
    expect(await processJobs({ handlers: failing })).toMatchObject({ done: 0, retried: 0, failed: 0 });

    await ownerDb.backgroundJob.update({ where: { id: job.id }, data: { runAt: new Date(Date.now() - 1_000) } });
    expect(await processJobs({ handlers: failing })).toMatchObject({ failed: 1 });
    job = await ownerDb.backgroundJob.findFirstOrThrow();
    expect(job).toMatchObject({ status: "FAILED", attempts: 2 });
    expect(job.completedAt).not.toBeNull();
  });

  it("un échec définitif n'est pas retenté", async () => {
    await enqueueAsSystem([email("a@ecole.bj")]);
    const result = await processJobs({
      handlers: handlers(async () => {
        throw new PermanentJobError("Numéro refusé");
      }),
    });

    expect(result).toMatchObject({ failed: 1, retried: 0 });
    expect(await ownerDb.backgroundJob.findFirstOrThrow()).toMatchObject({ status: "FAILED", attempts: 1, lastError: "Numéro refusé" });
  });

  it("une tâche restée en cours après un arrêt brutal est reprise", async () => {
    const job = await ownerDb.backgroundJob.create({
      data: {
        type: "email.send",
        payload: { to: "a@ecole.bj", subject: "Objet", html: "<p>x</p>" },
        status: "RUNNING",
        attempts: 1,
        lockedAt: new Date(Date.now() - 11 * 60_000),
      },
    });
    const recent = await ownerDb.backgroundJob.create({
      data: {
        type: "email.send",
        payload: { to: "b@ecole.bj", subject: "Objet", html: "<p>x</p>" },
        status: "RUNNING",
        attempts: 1,
        lockedAt: new Date(),
      },
    });
    const sent = vi.fn(async () => {});

    expect(await processJobs({ handlers: handlers(sent) })).toMatchObject({ done: 1 });
    expect(sent).toHaveBeenCalledWith(expect.objectContaining({ to: "a@ecole.bj" }));
    expect(await ownerDb.backgroundJob.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({ status: "DONE", attempts: 2 });
    // Un verrou récent appartient à un processus vivant : on n'y touche pas.
    expect(await ownerDb.backgroundJob.findUniqueOrThrow({ where: { id: recent.id } })).toMatchObject({ status: "RUNNING", attempts: 1 });
  });

  it("un type inconnu est abandonné sans bloquer les autres", async () => {
    await ownerDb.backgroundJob.create({ data: { type: "inconnu", payload: {} } });
    await enqueueAsSystem([email("a@ecole.bj")]);

    expect(await processJobs({ handlers: handlers() })).toMatchObject({ done: 1, failed: 1 });
  });

  it("RLS : un établissement n'enfile ni ne voit les tâches d'un autre", async () => {
    await expect(runWithDbContext(tenantContext([schoolA]), () => enqueueJobs([email("x@ecole.bj", schoolB)]))).rejects.toThrow();

    await runWithDbContext(tenantContext([schoolA]), () => enqueueJobs([email("a@ecole.bj", schoolA)]));
    await runWithDbContext(tenantContext([schoolB]), () => enqueueJobs([email("b@ecole.bj", schoolB)]));
    const visibleToA = await runWithDbContext(tenantContext([schoolA]), () =>
      prisma.backgroundJob.findMany({ select: { schoolId: true } }),
    );
    expect(visibleToA.map((job) => job.schoolId)).toEqual([schoolA]);
  });

  it("chaque tâche s'exécute dans le seul contexte de son établissement", async () => {
    await enqueueAsSystem([email("a@ecole.bj", schoolA), email("b@ecole.bj", schoolB)]);
    const visible: Record<string, (string | null)[]> = {};

    await processJobs({
      handlers: handlers(async (payload) => {
        const rows = await prisma.backgroundJob.findMany({ select: { schoolId: true } });
        visible[payload.to] = [...new Set(rows.map((row) => row.schoolId))];
      }),
    });

    expect(visible["a@ecole.bj"]).toEqual([schoolA]);
    expect(visible["b@ecole.bj"]).toEqual([schoolB]);
  });

  it("purge les tâches terminées anciennes et garde les récentes et celles à faire", async () => {
    const day = 24 * 60 * 60_000;
    const base = { type: "email.send", payload: {} };
    await ownerDb.backgroundJob.createMany({
      data: [
        { ...base, status: "DONE", completedAt: new Date(Date.now() - 8 * day) },
        { ...base, status: "DONE", completedAt: new Date(Date.now() - 1 * day) },
        { ...base, status: "FAILED", completedAt: new Date(Date.now() - 31 * day) },
        { ...base, status: "FAILED", completedAt: new Date(Date.now() - 8 * day) },
        { ...base, status: "PENDING", createdAt: new Date(Date.now() - 60 * day) },
      ],
    });

    expect(await purgeFinishedJobs()).toBe(2);
    expect(await ownerDb.backgroundJob.count()).toBe(3);
  });

  it("fournisseur coupé : la tâche est différée sans consommer de tentative", async () => {
    await enqueueAsSystem([{ ...email("a@ecole.bj"), maxAttempts: 1 }]);
    const result = await processJobs({
      handlers: handlers(async () => {
        throw new CircuitOpenError("email", 30_000);
      }),
    });

    expect(result).toMatchObject({ deferred: 1, retried: 0, failed: 0 });
    const job = await ownerDb.backgroundJob.findFirstOrThrow();
    expect(job).toMatchObject({ status: "PENDING", attempts: 0, lockedAt: null });
    expect(job.runAt.getTime()).toBeGreaterThan(Date.now() + 25_000);
  });

  it("file bornée : refus au seuil de 80 %, rien n'est inséré", async () => {
    vi.stubEnv("JOB_QUEUE_MAX", "10");
    try {
      await enqueueAsSystem(Array.from({ length: 8 }, (_, i) => email(`p${i}@ecole.bj`)));
      await expect(enqueueAsSystem([email("trop@ecole.bj")])).rejects.toBeInstanceOf(QueueSaturatedError);
      expect(await ownerDb.backgroundJob.count()).toBe(8);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
