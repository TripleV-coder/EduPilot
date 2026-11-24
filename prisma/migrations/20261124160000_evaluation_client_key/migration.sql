-- OFF-01 (2026-11-24) : clé d'idempotence d'une évaluation créée hors ligne.
ALTER TABLE "evaluations" ADD COLUMN "clientKey" TEXT;
CREATE UNIQUE INDEX "evaluations_clientKey_key" ON "evaluations"("clientKey");
