-- Identifiant du message chez le fournisseur (WhatsApp : wamid), pour relier
-- les statuts reçus (livré, lu, échoué) au message envoyé et déclencher le
-- SMS de secours (2026-11-14).
ALTER TABLE "communication_logs" ADD COLUMN "externalId" TEXT;

CREATE INDEX "communication_logs_externalId_idx" ON "communication_logs"("externalId");
