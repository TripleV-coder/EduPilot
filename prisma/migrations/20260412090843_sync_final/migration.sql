/*
  Warnings:

  - The values [SERIE_A] on the enum `RecommendedSeries` will be removed. If these variants are still used in the database, this will fail.
  - The `paymentStatus` column on the `event_participations` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `installment_payments` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `status` column on the `payment_plans` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[studentId,classId,date,timeSlot]` on the table `attendances` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[examTemplateId,studentId,attempt]` on the table `exam_sessions` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[reference]` on the table `payments` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `type` on the `scholarships` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "SiteType" AS ENUM ('MAIN', 'ANNEXE');

-- CreateEnum
CREATE TYPE "AcademicYearStatus" AS ENUM ('PLANNING', 'ACTIVE', 'ARCHIVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "PaymentPlanStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "ScholarshipType" AS ENUM ('MERIT', 'NEED_BASED', 'ATHLETIC', 'PARTIAL', 'FULL', 'OTHER');

-- AlterEnum
BEGIN;
CREATE TYPE "RecommendedSeries_new" AS ENUM ('SERIE_A1', 'SERIE_A2', 'SERIE_B', 'SERIE_C', 'SERIE_D', 'SERIE_E', 'SERIE_F1', 'SERIE_F2', 'SERIE_F3', 'SERIE_F4', 'SERIE_G1', 'SERIE_G2', 'SERIE_G3', 'STI', 'STA', 'EFS', 'MMV', 'TOUR', 'HR', 'FORMATION_PRO', 'APPRENTISSAGE');
ALTER TABLE "orientation_recommendations" ALTER COLUMN "recommendedSeries" TYPE "RecommendedSeries_new" USING ("recommendedSeries"::text::"RecommendedSeries_new");
ALTER TYPE "RecommendedSeries" RENAME TO "RecommendedSeries_old";
ALTER TYPE "RecommendedSeries_new" RENAME TO "RecommendedSeries";
DROP TYPE "public"."RecommendedSeries_old";
COMMIT;

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'STAFF';

-- DropForeignKey
ALTER TABLE "announcements" DROP CONSTRAINT "announcements_authorId_fkey";

-- DropForeignKey
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_createdById_fkey";

-- DropForeignKey
ALTER TABLE "attendances" DROP CONSTRAINT "attendances_recordedById_fkey";

-- DropForeignKey
ALTER TABLE "behavior_incidents" DROP CONSTRAINT "behavior_incidents_reportedById_fkey";

-- DropForeignKey
ALTER TABLE "certificates" DROP CONSTRAINT "certificates_issuedById_fkey";

-- DropForeignKey
ALTER TABLE "courses" DROP CONSTRAINT "courses_createdById_fkey";

-- DropForeignKey
ALTER TABLE "exam_templates" DROP CONSTRAINT "exam_templates_createdById_fkey";

-- DropForeignKey
ALTER TABLE "homeworks" DROP CONSTRAINT "homeworks_createdById_fkey";

-- DropForeignKey
ALTER TABLE "resources" DROP CONSTRAINT "resources_uploadedById_fkey";

-- DropForeignKey
ALTER TABLE "sanctions" DROP CONSTRAINT "sanctions_assignedById_fkey";

-- DropForeignKey
ALTER TABLE "school_events" DROP CONSTRAINT "school_events_createdById_fkey";

-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_schoolId_fkey";

-- DropIndex
DROP INDEX "attendances_studentId_classId_date_key";

-- DropIndex
DROP INDEX "enrollments_studentId_academicYearId_key";

-- DropIndex
DROP INDEX "exam_sessions_examTemplateId_studentId_key";

-- DropIndex
DROP INDEX "student_profiles_schoolId_matricule_key";

-- AlterTable
ALTER TABLE "academic_years" ADD COLUMN     "status" "AcademicYearStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "announcements" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ALTER COLUMN "authorId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "appointments" ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "attendances" ADD COLUMN     "timeSlot" TEXT,
ALTER COLUMN "recordedById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "behavior_incidents" ALTER COLUMN "reportedById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "certificates" ALTER COLUMN "issuedById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "classes" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "courses" ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "event_participations" DROP COLUMN "paymentStatus",
ADD COLUMN     "paymentStatus" "PaymentStatus" DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "exam_sessions" ADD COLUMN     "attempt" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "exam_templates" ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "fees" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "grades" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "homeworks" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "installment_payments" DROP COLUMN "status",
ADD COLUMN     "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "payment_plans" DROP COLUMN "status",
ADD COLUMN     "status" "PaymentPlanStatus" NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "resources" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ALTER COLUMN "uploadedById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "sanctions" ALTER COLUMN "assignedById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "scholarships" DROP COLUMN "type",
ADD COLUMN     "type" "ScholarshipType" NOT NULL;

-- AlterTable
ALTER TABLE "school_events" ALTER COLUMN "createdById" DROP NOT NULL;

-- AlterTable
ALTER TABLE "schools" ADD COLUMN     "organizationId" TEXT,
ADD COLUMN     "planId" TEXT,
ADD COLUMN     "siteType" "SiteType" NOT NULL DEFAULT 'MAIN',
ADD COLUMN     "subscriptionStatus" "SubscriptionStatus" DEFAULT 'TRIAL';

-- AlterTable
ALTER TABLE "student_profiles" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ALTER COLUMN "nationality" DROP DEFAULT;

-- AlterTable
ALTER TABLE "subjects" ADD COLUMN     "coefficient" DECIMAL(5,2) NOT NULL DEFAULT 1,
ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "teacher_profiles" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "teacher_school_assignments" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "preferences" JSONB DEFAULT '{}',
ADD COLUMN     "roles" "UserRole"[];

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "maxStudents" INTEGER NOT NULL DEFAULT 100,
    "maxTeachers" INTEGER NOT NULL DEFAULT 10,
    "maxStorageGB" INTEGER NOT NULL DEFAULT 5,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priceMonthly" DECIMAL(10,2) NOT NULL,
    "priceYearly" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_memberships" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "canManageSites" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canteen_menus" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "weekNumber" INTEGER,
    "starterName" TEXT,
    "mainCourse" TEXT NOT NULL,
    "sideDish" TEXT,
    "dessert" TEXT,
    "vegetarian" BOOLEAN NOT NULL DEFAULT false,
    "allergens" TEXT[],
    "priceStudent" DECIMAL(6,2) NOT NULL,
    "priceStaff" DECIMAL(6,2),
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canteen_menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_tickets" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "qrCode" TEXT NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "paymentId" TEXT,

    CONSTRAINT "meal_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "category" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_achievements" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaderboard" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "period" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leaderboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "books" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "isbn" TEXT,
    "category" TEXT,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "available" INTEGER NOT NULL DEFAULT 1,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrowing_records" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "borrowedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "returnedAt" TIMESTAMP(3),
    "fine" DECIMAL(10,2),
    "isPending" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "borrowing_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_logs" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "userId" TEXT,
    "recipient" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TRANSACTIONAL',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channels" TEXT[] DEFAULT ARRAY['EMAIL']::TEXT[],
    "language" TEXT NOT NULL DEFAULT 'fr',
    "quietHoursStart" TEXT,
    "quietHoursEnd" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "communication_templates" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "name" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'fr',
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "communication_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_name_key" ON "subscription_plans"("name");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_code_key" ON "subscription_plans"("code");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_code_key" ON "organizations"("code");

-- CreateIndex
CREATE INDEX "organization_memberships_userId_idx" ON "organization_memberships"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_memberships_organizationId_userId_key" ON "organization_memberships"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "canteen_menus_schoolId_date_idx" ON "canteen_menus"("schoolId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "canteen_menus_schoolId_date_key" ON "canteen_menus"("schoolId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "meal_tickets_qrCode_key" ON "meal_tickets"("qrCode");

-- CreateIndex
CREATE INDEX "meal_tickets_schoolId_userId_idx" ON "meal_tickets"("schoolId", "userId");

-- CreateIndex
CREATE INDEX "meal_tickets_qrCode_idx" ON "meal_tickets"("qrCode");

-- CreateIndex
CREATE UNIQUE INDEX "achievements_code_key" ON "achievements"("code");

-- CreateIndex
CREATE INDEX "user_achievements_userId_idx" ON "user_achievements"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_achievements_userId_achievementId_key" ON "user_achievements"("userId", "achievementId");

-- CreateIndex
CREATE INDEX "leaderboard_schoolId_points_idx" ON "leaderboard"("schoolId", "points");

-- CreateIndex
CREATE UNIQUE INDEX "leaderboard_schoolId_userId_period_key" ON "leaderboard"("schoolId", "userId", "period");

-- CreateIndex
CREATE INDEX "books_schoolId_idx" ON "books"("schoolId");

-- CreateIndex
CREATE INDEX "books_isbn_idx" ON "books"("isbn");

-- CreateIndex
CREATE INDEX "borrowing_records_bookId_idx" ON "borrowing_records"("bookId");

-- CreateIndex
CREATE INDEX "borrowing_records_studentId_idx" ON "borrowing_records"("studentId");

-- CreateIndex
CREATE INDEX "borrowing_records_isPending_idx" ON "borrowing_records"("isPending");

-- CreateIndex
CREATE INDEX "communication_logs_schoolId_idx" ON "communication_logs"("schoolId");

-- CreateIndex
CREATE INDEX "communication_logs_userId_idx" ON "communication_logs"("userId");

-- CreateIndex
CREATE INDEX "communication_logs_status_idx" ON "communication_logs"("status");

-- CreateIndex
CREATE INDEX "communication_logs_createdAt_idx" ON "communication_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "communication_preferences_userId_key" ON "communication_preferences"("userId");

-- CreateIndex
CREATE INDEX "communication_templates_schoolId_idx" ON "communication_templates"("schoolId");

-- CreateIndex
CREATE INDEX "communication_templates_name_language_idx" ON "communication_templates"("name", "language");

-- CreateIndex
CREATE UNIQUE INDEX "attendances_studentId_classId_date_timeSlot_key" ON "attendances"("studentId", "classId", "date", "timeSlot");

-- CreateIndex
CREATE INDEX "enrollments_studentId_academicYearId_idx" ON "enrollments"("studentId", "academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "exam_sessions_examTemplateId_studentId_attempt_key" ON "exam_sessions"("examTemplateId", "studentId", "attempt");

-- CreateIndex
CREATE INDEX "fees_schoolId_idx" ON "fees"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_reference_key" ON "payments"("reference");

-- CreateIndex
CREATE INDEX "payments_studentId_feeId_idx" ON "payments"("studentId", "feeId");

-- CreateIndex
CREATE INDEX "schools_organizationId_idx" ON "schools"("organizationId");

-- CreateIndex
CREATE INDEX "schools_email_idx" ON "schools"("email");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "student_profiles_schoolId_matricule_idx" ON "student_profiles"("schoolId", "matricule");

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schools" ADD CONSTRAINT "schools_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schools" ADD CONSTRAINT "schools_planId_fkey" FOREIGN KEY ("planId") REFERENCES "subscription_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homeworks" ADD CONSTRAINT "homeworks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "behavior_incidents" ADD CONSTRAINT "behavior_incidents_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sanctions" ADD CONSTRAINT "sanctions_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_events" ADD CONSTRAINT "school_events_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_templates" ADD CONSTRAINT "exam_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canteen_menus" ADD CONSTRAINT "canteen_menus_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_tickets" ADD CONSTRAINT "meal_tickets_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_tickets" ADD CONSTRAINT "meal_tickets_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_tickets" ADD CONSTRAINT "meal_tickets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard" ADD CONSTRAINT "leaderboard_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaderboard" ADD CONSTRAINT "leaderboard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrowing_records" ADD CONSTRAINT "borrowing_records_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrowing_records" ADD CONSTRAINT "borrowing_records_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_logs" ADD CONSTRAINT "communication_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_preferences" ADD CONSTRAINT "communication_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "communication_templates" ADD CONSTRAINT "communication_templates_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
