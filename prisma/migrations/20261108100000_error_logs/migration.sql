-- Journal des erreurs serveur et navigateur (remplace Sentry, 2026-11-08)
CREATE TABLE "error_logs" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "path" TEXT,
    "digest" TEXT,
    "stack" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "error_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "error_logs_createdAt_idx" ON "error_logs"("createdAt");
CREATE INDEX "error_logs_fingerprint_createdAt_idx" ON "error_logs"("fingerprint", "createdAt");
