-- AlterTable: suivi des relances d'échéance (idempotence des rappels finance)
ALTER TABLE "installment_payments" ADD COLUMN     "lastReminderStage" TEXT,
ADD COLUMN     "lastReminderAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "installment_payments_status_idx" ON "installment_payments"("status");
