-- FIN-02 (2026-11-24) : journal des événements authentifiés des fournisseurs de paiement.
CREATE TABLE "payment_provider_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "schoolId" TEXT,
    "paymentAccountId" TEXT,
    "reference" TEXT,
    "transactionId" TEXT,
    "amount" INTEGER,
    "currency" TEXT,
    "providerStatus" TEXT,
    "receivedCount" INTEGER NOT NULL DEFAULT 1,
    "outcome" TEXT,
    "firstReceivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReceivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_provider_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "payment_provider_events_provider_eventKey_key" ON "payment_provider_events"("provider", "eventKey");
CREATE INDEX "payment_provider_events_reference_idx" ON "payment_provider_events"("reference");
CREATE INDEX "payment_provider_events_schoolId_firstReceivedAt_idx" ON "payment_provider_events"("schoolId", "firstReceivedAt");
