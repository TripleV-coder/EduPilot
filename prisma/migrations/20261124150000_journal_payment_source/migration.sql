-- FIN-04 (2026-11-24) : écritures comptables générées par les paiements de frais.
ALTER TABLE "journal_entries" ADD COLUMN "sourcePaymentId" TEXT;
ALTER TABLE "journal_entries" ADD COLUMN "sourceAmountFcfa" BIGINT;
CREATE INDEX "journal_entries_sourcePaymentId_idx" ON "journal_entries"("sourcePaymentId");
