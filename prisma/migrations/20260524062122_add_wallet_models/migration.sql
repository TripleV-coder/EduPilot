-- CreateEnum
CREATE TYPE "WalletAccountKind" AS ENUM ('BANK', 'MTN', 'MOOV', 'CELTIIS', 'CASH', 'OTHER');

-- CreateEnum
CREATE TYPE "WalletTxDirection" AS ENUM ('INFLOW', 'OUTFLOW');

-- CreateEnum
CREATE TYPE "WalletTxMatchStatus" AS ENUM ('AUTO_MATCHED', 'MANUAL_MATCHED', 'UNMATCHED', 'DISBURSEMENT');

-- CreateEnum
CREATE TYPE "DisbursementMode" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "DisbursementStatus" AS ENUM ('PENDING', 'VALIDATED', 'EXECUTED', 'CANCELLED');

-- AlterTable
ALTER TABLE "schools" ADD COLUMN     "emailDomain" TEXT,
ADD COLUMN     "mempCode" TEXT,
ADD COLUMN     "motto" TEXT,
ADD COLUMN     "primaryColor" TEXT;

-- CreateTable
CREATE TABLE "wallet_accounts" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "WalletAccountKind" NOT NULL,
    "accountRef" TEXT,
    "balanceFcfa" BIGINT NOT NULL DEFAULT 0,
    "colorHex" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "direction" "WalletTxDirection" NOT NULL,
    "amountFcfa" BIGINT NOT NULL,
    "reference" TEXT,
    "partyName" TEXT,
    "detail" TEXT,
    "matchStatus" "WalletTxMatchStatus" NOT NULL DEFAULT 'UNMATCHED',
    "matchLabel" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_disbursements" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "accountId" TEXT,
    "label" TEXT NOT NULL,
    "amountFcfa" BIGINT NOT NULL,
    "mode" "DisbursementMode" NOT NULL DEFAULT 'AUTO',
    "status" "DisbursementStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_disbursements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wallet_accounts_schoolId_isActive_idx" ON "wallet_accounts"("schoolId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_accounts_schoolId_name_key" ON "wallet_accounts"("schoolId", "name");

-- CreateIndex
CREATE INDEX "wallet_transactions_schoolId_occurredAt_idx" ON "wallet_transactions"("schoolId", "occurredAt");

-- CreateIndex
CREATE INDEX "wallet_transactions_accountId_occurredAt_idx" ON "wallet_transactions"("accountId", "occurredAt");

-- CreateIndex
CREATE INDEX "scheduled_disbursements_schoolId_scheduledAt_idx" ON "scheduled_disbursements"("schoolId", "scheduledAt");

-- CreateIndex
CREATE INDEX "scheduled_disbursements_status_idx" ON "scheduled_disbursements"("status");

-- CreateIndex
CREATE INDEX "class_subjects_teacherId_idx" ON "class_subjects"("teacherId");

-- CreateIndex
CREATE INDEX "classes_schoolId_classLevelId_idx" ON "classes"("schoolId", "classLevelId");

-- CreateIndex
CREATE INDEX "enrollments_classId_academicYearId_idx" ON "enrollments"("classId", "academicYearId");

-- CreateIndex
CREATE INDEX "student_profiles_schoolId_createdAt_idx" ON "student_profiles"("schoolId", "createdAt");

-- CreateIndex
CREATE INDEX "users_schoolId_role_idx" ON "users"("schoolId", "role");

-- AddForeignKey
ALTER TABLE "wallet_accounts" ADD CONSTRAINT "wallet_accounts_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "wallet_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_disbursements" ADD CONSTRAINT "scheduled_disbursements_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheduled_disbursements" ADD CONSTRAINT "scheduled_disbursements_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "wallet_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
