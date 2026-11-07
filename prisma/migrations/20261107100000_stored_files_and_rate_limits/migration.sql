-- Hébergement sans serveur (2026-11-07) : fichiers envoyés en base et
-- compteurs de limite de débit partagés entre instances, sans Redis.

-- CreateTable
CREATE TABLE "stored_files" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "storedFilename" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "schoolId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_counters" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_counters_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "stored_files_storedFilename_key" ON "stored_files"("storedFilename");

-- CreateIndex
CREATE INDEX "stored_files_uploaderId_idx" ON "stored_files"("uploaderId");

-- CreateIndex
CREATE INDEX "stored_files_schoolId_idx" ON "stored_files"("schoolId");

-- CreateIndex
CREATE INDEX "rate_limit_counters_resetAt_idx" ON "rate_limit_counters"("resetAt");

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
