-- CreateEnum
CREATE TYPE "CagnotteStatus" AS ENUM ('OPEN', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CagnotteJournalKind" AS ENUM ('CREATED', 'CONTRIBUTION_PAID', 'CONTRIBUTION_REFUNDED', 'CLOSED', 'DISBURSED', 'NOTE');

-- CreateTable
CREATE TABLE "cagnottes" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "classId" TEXT,
    "hostUserId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetFcfa" BIGINT NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "status" "CagnotteStatus" NOT NULL DEFAULT 'OPEN',
    "expectedParticipants" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cagnottes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cagnotte_contributions" (
    "id" TEXT NOT NULL,
    "cagnotteId" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "amountFcfa" BIGINT NOT NULL,
    "paymentRef" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cagnotte_contributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cagnotte_journal_entries" (
    "id" TEXT NOT NULL,
    "cagnotteId" TEXT NOT NULL,
    "kind" "CagnotteJournalKind" NOT NULL,
    "actorUserId" TEXT,
    "amountFcfa" BIGINT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cagnotte_journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cagnottes_schoolId_status_idx" ON "cagnottes"("schoolId", "status");

-- CreateIndex
CREATE INDEX "cagnottes_deadline_idx" ON "cagnottes"("deadline");

-- CreateIndex
CREATE INDEX "cagnotte_contributions_cagnotteId_paidAt_idx" ON "cagnotte_contributions"("cagnotteId", "paidAt");

-- CreateIndex
CREATE INDEX "cagnotte_contributions_parentUserId_idx" ON "cagnotte_contributions"("parentUserId");

-- CreateIndex
CREATE INDEX "cagnotte_journal_entries_cagnotteId_createdAt_idx" ON "cagnotte_journal_entries"("cagnotteId", "createdAt");

-- AddForeignKey
ALTER TABLE "cagnottes" ADD CONSTRAINT "cagnottes_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cagnottes" ADD CONSTRAINT "cagnottes_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cagnottes" ADD CONSTRAINT "cagnottes_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cagnotte_contributions" ADD CONSTRAINT "cagnotte_contributions_cagnotteId_fkey" FOREIGN KEY ("cagnotteId") REFERENCES "cagnottes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cagnotte_contributions" ADD CONSTRAINT "cagnotte_contributions_parentUserId_fkey" FOREIGN KEY ("parentUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cagnotte_journal_entries" ADD CONSTRAINT "cagnotte_journal_entries_cagnotteId_fkey" FOREIGN KEY ("cagnotteId") REFERENCES "cagnottes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cagnotte_journal_entries" ADD CONSTRAINT "cagnotte_journal_entries_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
