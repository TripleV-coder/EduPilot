-- CreateEnum
CREATE TYPE "WellbeingReportTag" AS ENUM ('ANONYME', 'PARENT', 'ENSEIGNANT', 'AUTO_IA', 'NOMINATIF');

-- CreateEnum
CREATE TYPE "WellbeingReportSeverity" AS ENUM ('P0', 'P1', 'P2');

-- CreateEnum
CREATE TYPE "WellbeingReportStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'IN_FOLLOWUP', 'CLOSED');

-- CreateEnum
CREATE TYPE "OhadaAccountType" AS ENUM ('ASSET', 'LIABILITY', 'INCOME', 'EXPENSE', 'EQUITY');

-- CreateEnum
CREATE TYPE "FiscalYearStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "JournalEntryStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');

-- CreateTable
CREATE TABLE "wellbeing_reports" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "reporterUserId" TEXT,
    "reportedUserId" TEXT,
    "tag" "WellbeingReportTag" NOT NULL,
    "category" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,
    "severity" "WellbeingReportSeverity" NOT NULL,
    "severityLabel" TEXT,
    "status" "WellbeingReportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wellbeing_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "psy_appointments" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "psyUserId" TEXT,
    "studentUserId" TEXT,
    "anonymousLabel" TEXT,
    "startAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "kind" TEXT NOT NULL,
    "variantHint" TEXT,
    "isUrgent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "psy_appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "climate_pulse_weeks" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "weekLabel" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "averageScore" DOUBLE PRECISION NOT NULL,
    "responses" INTEGER NOT NULL DEFAULT 0,
    "pctSafety" DOUBLE PRECISION,
    "pctFriend" DOUBLE PRECISION,
    "pctAdultListens" DOUBLE PRECISION,
    "pctHarassWitness" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "climate_pulse_weeks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fiscal_years" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "FiscalYearStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fiscal_years_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ohada_accounts" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "syscohadaCode" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "OhadaAccountType" NOT NULL,
    "balanceFcfa" BIGINT NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ohada_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "fiscalYearId" TEXT NOT NULL,
    "pieceRef" TEXT NOT NULL,
    "entryDate" TIMESTAMP(3) NOT NULL,
    "label" TEXT NOT NULL,
    "status" "JournalEntryStatus" NOT NULL DEFAULT 'POSTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entry_lines" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "debitAccountId" TEXT,
    "creditAccountId" TEXT,
    "amountFcfa" BIGINT NOT NULL,
    "label" TEXT,

    CONSTRAINT "journal_entry_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wellbeing_reports_schoolId_status_severity_idx" ON "wellbeing_reports"("schoolId", "status", "severity");

-- CreateIndex
CREATE INDEX "wellbeing_reports_createdAt_idx" ON "wellbeing_reports"("createdAt");

-- CreateIndex
CREATE INDEX "psy_appointments_schoolId_startAt_idx" ON "psy_appointments"("schoolId", "startAt");

-- CreateIndex
CREATE INDEX "climate_pulse_weeks_schoolId_weekStart_idx" ON "climate_pulse_weeks"("schoolId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "climate_pulse_weeks_schoolId_weekLabel_key" ON "climate_pulse_weeks"("schoolId", "weekLabel");

-- CreateIndex
CREATE INDEX "fiscal_years_schoolId_status_idx" ON "fiscal_years"("schoolId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "fiscal_years_schoolId_label_key" ON "fiscal_years"("schoolId", "label");

-- CreateIndex
CREATE INDEX "ohada_accounts_schoolId_type_idx" ON "ohada_accounts"("schoolId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "ohada_accounts_schoolId_syscohadaCode_key" ON "ohada_accounts"("schoolId", "syscohadaCode");

-- CreateIndex
CREATE INDEX "journal_entries_schoolId_entryDate_idx" ON "journal_entries"("schoolId", "entryDate");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_schoolId_pieceRef_key" ON "journal_entries"("schoolId", "pieceRef");

-- CreateIndex
CREATE INDEX "journal_entry_lines_journalEntryId_idx" ON "journal_entry_lines"("journalEntryId");

-- AddForeignKey
ALTER TABLE "wellbeing_reports" ADD CONSTRAINT "wellbeing_reports_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wellbeing_reports" ADD CONSTRAINT "wellbeing_reports_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wellbeing_reports" ADD CONSTRAINT "wellbeing_reports_reportedUserId_fkey" FOREIGN KEY ("reportedUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psy_appointments" ADD CONSTRAINT "psy_appointments_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psy_appointments" ADD CONSTRAINT "psy_appointments_psyUserId_fkey" FOREIGN KEY ("psyUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "psy_appointments" ADD CONSTRAINT "psy_appointments_studentUserId_fkey" FOREIGN KEY ("studentUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "climate_pulse_weeks" ADD CONSTRAINT "climate_pulse_weeks_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fiscal_years" ADD CONSTRAINT "fiscal_years_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ohada_accounts" ADD CONSTRAINT "ohada_accounts_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "fiscal_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_debitAccountId_fkey" FOREIGN KEY ("debitAccountId") REFERENCES "ohada_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_creditAccountId_fkey" FOREIGN KEY ("creditAccountId") REFERENCES "ohada_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
