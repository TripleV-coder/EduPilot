-- CreateEnum
CREATE TYPE "VoiceLang" AS ENUM ('FR', 'FON', 'YOR', 'BAR', 'DIN');

-- CreateEnum
CREATE TYPE "VoiceCampaignStatus" AS ENUM ('DRAFT', 'SYNTHESIZED', 'DISPATCHED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VoiceTemplateKind" AS ENUM ('RAPPEL_SCOLARITE', 'ABSENCE', 'CONVOCATION', 'BULLETIN', 'LIBRE');

-- CreateTable
CREATE TABLE "voice_campaigns" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "templateKind" "VoiceTemplateKind" NOT NULL DEFAULT 'LIBRE',
    "textFr" TEXT NOT NULL,
    "status" "VoiceCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "audienceSize" INTEGER NOT NULL DEFAULT 0,
    "reachedCount" INTEGER NOT NULL DEFAULT 0,
    "listenedCount" INTEGER NOT NULL DEFAULT 0,
    "costFcfa" INTEGER NOT NULL DEFAULT 0,
    "dispatchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_campaign_translations" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "lang" "VoiceLang" NOT NULL,
    "text" TEXT NOT NULL,
    "audioUrl" TEXT,
    "narratorRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_campaign_translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benchmark_snapshots" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodLabel" TEXT NOT NULL,
    "rankNational" INTEGER,
    "rankDept" INTEGER,
    "rankPeerGroup" INTEGER,
    "totalNational" INTEGER,
    "totalDept" INTEGER,
    "totalPeer" INTEGER,
    "scoreOverall" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "benchmark_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benchmark_snapshot_indicators" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "schoolValue" DOUBLE PRECISION NOT NULL,
    "nationalValue" DOUBLE PRECISION,
    "departmentValue" DOUBLE PRECISION,
    "peerValue" DOUBLE PRECISION,
    "unit" TEXT,
    "tone" TEXT,

    CONSTRAINT "benchmark_snapshot_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "voice_campaigns_schoolId_status_idx" ON "voice_campaigns"("schoolId", "status");

-- CreateIndex
CREATE INDEX "voice_campaigns_dispatchedAt_idx" ON "voice_campaigns"("dispatchedAt");

-- CreateIndex
CREATE UNIQUE INDEX "voice_campaign_translations_campaignId_lang_key" ON "voice_campaign_translations"("campaignId", "lang");

-- CreateIndex
CREATE INDEX "benchmark_snapshots_schoolId_capturedAt_idx" ON "benchmark_snapshots"("schoolId", "capturedAt");

-- CreateIndex
CREATE INDEX "benchmark_snapshot_indicators_snapshotId_idx" ON "benchmark_snapshot_indicators"("snapshotId");

-- AddForeignKey
ALTER TABLE "voice_campaigns" ADD CONSTRAINT "voice_campaigns_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_campaigns" ADD CONSTRAINT "voice_campaigns_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_campaign_translations" ADD CONSTRAINT "voice_campaign_translations_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "voice_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benchmark_snapshots" ADD CONSTRAINT "benchmark_snapshots_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "benchmark_snapshot_indicators" ADD CONSTRAINT "benchmark_snapshot_indicators_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "benchmark_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
