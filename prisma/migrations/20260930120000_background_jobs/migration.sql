-- File de tâches de fond durable (src/lib/jobs/queue.ts). Les envois e-mail et
-- SMS sortent des requêtes HTTP : une relance de 1 000 familles faisait 1 000
-- allers-retours fournisseur pendant que l'utilisateur attendait la réponse,
-- et un redémarrage en cours d'envoi perdait le reste.

-- CreateEnum
CREATE TYPE "BackgroundJobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "background_jobs" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "schoolId" TEXT,
    "status" "BackgroundJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "background_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "background_jobs_status_runAt_idx" ON "background_jobs"("status", "runAt");

-- CreateIndex
CREATE INDEX "background_jobs_schoolId_idx" ON "background_jobs"("schoolId");

-- AddForeignKey
ALTER TABLE "background_jobs" ADD CONSTRAINT "background_jobs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Les charges utiles portent les adresses et téléphones des familles : mêmes
-- règles que les tables sensibles (audit M2). Une requête n'enfile et ne voit
-- que les tâches de ses établissements ; le processeur tourne en contexte
-- système. Une tâche sans établissement n'est visible qu'en contexte système.
ALTER TABLE "background_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "background_jobs" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "background_jobs"
  USING ((SELECT app_rls_bypass()) OR "schoolId" = ANY ((SELECT app_school_ids())::text[]))
  WITH CHECK ((SELECT app_rls_bypass()) OR "schoolId" = ANY ((SELECT app_school_ids())::text[]));
