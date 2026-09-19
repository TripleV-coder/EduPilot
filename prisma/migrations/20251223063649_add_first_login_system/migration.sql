-- CreateEnum
CREATE TYPE "HolidayType" AS ENUM ('CHRISTMAS', 'NEW_YEAR', 'EASTER', 'SUMMER', 'FEBRUARY', 'SPRING', 'TOUSSAINT', 'OTHER');

-- CreateEnum
CREATE TYPE "PublicHolidayType" AS ENUM ('NATIONAL', 'RELIGIOUS', 'INTERNATIONAL', 'LOCAL');

-- CreateEnum
CREATE TYPE "CalendarEventType" AS ENUM ('PRE_RENTREE', 'RENTREE', 'FIN_TRIMESTRE', 'FIN_SEMESTRE', 'CONSEIL_CLASSE', 'REUNION_PARENTS', 'EXAMEN', 'COMPOSITION', 'REMISE_BULLETINS', 'CEREMONIE', 'JOURNEE_PEDAGOGIQUE', 'FORMATION', 'FIN_ANNEE', 'OTHER');

-- CreateEnum
CREATE TYPE "OrientationStatus" AS ENUM ('PENDING', 'ANALYZED', 'RECOMMENDED', 'VALIDATED', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RecommendedSeries" AS ENUM ('SERIE_A', 'SERIE_B', 'SERIE_C', 'SERIE_D', 'SERIE_E', 'SERIE_F1', 'SERIE_F2', 'SERIE_F3', 'SERIE_F4', 'SERIE_G1', 'SERIE_G2', 'SERIE_G3', 'FORMATION_PRO', 'APPRENTISSAGE');

-- CreateEnum
CREATE TYPE "SubjectGroup" AS ENUM ('LITTERAIRE', 'SCIENTIFIQUE', 'ECONOMIQUE', 'TECHNIQUE', 'LANGUES', 'ARTS', 'SPORT');

-- CreateEnum
CREATE TYPE "PerformanceTrend" AS ENUM ('STRONG_INCREASE', 'INCREASE', 'STABLE', 'DECREASE', 'STRONG_DECREASE');

-- CreateEnum
CREATE TYPE "PerformanceLevel" AS ENUM ('EXCELLENT', 'VERY_GOOD', 'GOOD', 'AVERAGE', 'INSUFFICIENT', 'WEAK');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ProfessionCategory" AS ENUM ('AGRICULTURE', 'ARTISANAT', 'COMMERCE', 'EDUCATION', 'SANTE', 'FONCTION_PUBLIQUE', 'LIBERAL', 'TECHNIQUE', 'SERVICE', 'SANS_EMPLOI', 'AUTRE');

-- CreateTable
CREATE TABLE "first_login_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "tempPassword" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "first_login_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_holidays" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "HolidayType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_holidays" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "name" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "PublicHolidayType" NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "school_calendar_events" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CalendarEventType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isAllDay" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "targetRoles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_orientations" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "classLevelId" TEXT NOT NULL,
    "status" "OrientationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_orientations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orientation_recommendations" (
    "id" TEXT NOT NULL,
    "orientationId" TEXT NOT NULL,
    "recommendedSeries" "RecommendedSeries" NOT NULL,
    "rank" INTEGER NOT NULL DEFAULT 1,
    "score" DECIMAL(5,2) NOT NULL,
    "justification" TEXT NOT NULL,
    "strengths" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isValidated" BOOLEAN NOT NULL DEFAULT false,
    "validatedById" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orientation_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subject_group_analyses" (
    "id" TEXT NOT NULL,
    "orientationId" TEXT NOT NULL,
    "subjectGroup" "SubjectGroup" NOT NULL,
    "averageScore" DECIMAL(5,2) NOT NULL,
    "trend" "PerformanceTrend" NOT NULL,
    "consistency" DECIMAL(5,2) NOT NULL,
    "gradesCount" INTEGER NOT NULL DEFAULT 0,
    "minGrade" DECIMAL(5,2),
    "maxGrade" DECIMAL(5,2),
    "analysis" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subject_group_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "student_analytics" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "generalAverage" DECIMAL(5,2),
    "classRank" INTEGER,
    "classSize" INTEGER,
    "performanceLevel" "PerformanceLevel",
    "progressionRate" DECIMAL(5,2),
    "consistencyRate" DECIMAL(5,2),
    "riskLevel" "RiskLevel" NOT NULL DEFAULT 'NONE',
    "riskFactors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subject_performances" (
    "id" TEXT NOT NULL,
    "analyticsId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "average" DECIMAL(5,2),
    "gradesCount" INTEGER NOT NULL DEFAULT 0,
    "minGrade" DECIMAL(5,2),
    "maxGrade" DECIMAL(5,2),
    "standardDev" DECIMAL(5,2),
    "isStrength" BOOLEAN NOT NULL DEFAULT false,
    "isWeakness" BOOLEAN NOT NULL DEFAULT false,
    "trend" "PerformanceTrend",
    "progressionRate" DECIMAL(5,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subject_performances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grade_history" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "subjectId" TEXT,
    "periodId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "average" DECIMAL(5,2) NOT NULL,
    "rank" INTEGER,
    "classSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grade_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'BJ',
    "region" TEXT,
    "population" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "professions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ProfessionCategory" NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "professions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nationalities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nationalities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subject_categories" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "icon" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subject_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_options" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT,
    "category" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "first_login_tokens_token_key" ON "first_login_tokens"("token");

-- CreateIndex
CREATE INDEX "first_login_tokens_token_idx" ON "first_login_tokens"("token");

-- CreateIndex
CREATE INDEX "first_login_tokens_userId_idx" ON "first_login_tokens"("userId");

-- CreateIndex
CREATE INDEX "first_login_tokens_expiresAt_idx" ON "first_login_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- CreateIndex
CREATE INDEX "system_settings_key_idx" ON "system_settings"("key");

-- CreateIndex
CREATE INDEX "school_holidays_schoolId_academicYearId_idx" ON "school_holidays"("schoolId", "academicYearId");

-- CreateIndex
CREATE INDEX "school_holidays_startDate_endDate_idx" ON "school_holidays"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "public_holidays_date_idx" ON "public_holidays"("date");

-- CreateIndex
CREATE INDEX "public_holidays_schoolId_idx" ON "public_holidays"("schoolId");

-- CreateIndex
CREATE INDEX "school_calendar_events_schoolId_academicYearId_idx" ON "school_calendar_events"("schoolId", "academicYearId");

-- CreateIndex
CREATE INDEX "school_calendar_events_startDate_idx" ON "school_calendar_events"("startDate");

-- CreateIndex
CREATE INDEX "school_calendar_events_type_idx" ON "school_calendar_events"("type");

-- CreateIndex
CREATE INDEX "student_orientations_studentId_idx" ON "student_orientations"("studentId");

-- CreateIndex
CREATE INDEX "student_orientations_academicYearId_idx" ON "student_orientations"("academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "student_orientations_studentId_academicYearId_key" ON "student_orientations"("studentId", "academicYearId");

-- CreateIndex
CREATE INDEX "orientation_recommendations_orientationId_idx" ON "orientation_recommendations"("orientationId");

-- CreateIndex
CREATE INDEX "subject_group_analyses_orientationId_idx" ON "subject_group_analyses"("orientationId");

-- CreateIndex
CREATE UNIQUE INDEX "subject_group_analyses_orientationId_subjectGroup_key" ON "subject_group_analyses"("orientationId", "subjectGroup");

-- CreateIndex
CREATE INDEX "student_analytics_studentId_idx" ON "student_analytics"("studentId");

-- CreateIndex
CREATE INDEX "student_analytics_periodId_idx" ON "student_analytics"("periodId");

-- CreateIndex
CREATE INDEX "student_analytics_academicYearId_idx" ON "student_analytics"("academicYearId");

-- CreateIndex
CREATE INDEX "student_analytics_performanceLevel_idx" ON "student_analytics"("performanceLevel");

-- CreateIndex
CREATE INDEX "student_analytics_riskLevel_idx" ON "student_analytics"("riskLevel");

-- CreateIndex
CREATE UNIQUE INDEX "student_analytics_studentId_periodId_key" ON "student_analytics"("studentId", "periodId");

-- CreateIndex
CREATE INDEX "subject_performances_analyticsId_idx" ON "subject_performances"("analyticsId");

-- CreateIndex
CREATE INDEX "subject_performances_subjectId_idx" ON "subject_performances"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "subject_performances_analyticsId_subjectId_key" ON "subject_performances"("analyticsId", "subjectId");

-- CreateIndex
CREATE INDEX "grade_history_studentId_idx" ON "grade_history"("studentId");

-- CreateIndex
CREATE INDEX "grade_history_subjectId_idx" ON "grade_history"("subjectId");

-- CreateIndex
CREATE INDEX "grade_history_periodId_idx" ON "grade_history"("periodId");

-- CreateIndex
CREATE UNIQUE INDEX "grade_history_studentId_subjectId_periodId_key" ON "grade_history"("studentId", "subjectId", "periodId");

-- CreateIndex
CREATE INDEX "cities_countryCode_idx" ON "cities"("countryCode");

-- CreateIndex
CREATE INDEX "cities_region_idx" ON "cities"("region");

-- CreateIndex
CREATE UNIQUE INDEX "cities_name_countryCode_key" ON "cities"("name", "countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "professions_name_key" ON "professions"("name");

-- CreateIndex
CREATE INDEX "professions_category_idx" ON "professions"("category");

-- CreateIndex
CREATE UNIQUE INDEX "nationalities_name_key" ON "nationalities"("name");

-- CreateIndex
CREATE UNIQUE INDEX "nationalities_code_key" ON "nationalities"("code");

-- CreateIndex
CREATE INDEX "nationalities_code_idx" ON "nationalities"("code");

-- CreateIndex
CREATE INDEX "subject_categories_schoolId_idx" ON "subject_categories"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "subject_categories_schoolId_code_key" ON "subject_categories"("schoolId", "code");

-- CreateIndex
CREATE INDEX "config_options_schoolId_category_idx" ON "config_options"("schoolId", "category");

-- CreateIndex
CREATE INDEX "config_options_category_idx" ON "config_options"("category");

-- CreateIndex
CREATE UNIQUE INDEX "config_options_schoolId_category_code_key" ON "config_options"("schoolId", "category", "code");

-- AddForeignKey
ALTER TABLE "first_login_tokens" ADD CONSTRAINT "first_login_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_holidays" ADD CONSTRAINT "school_holidays_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_holidays" ADD CONSTRAINT "school_holidays_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_holidays" ADD CONSTRAINT "public_holidays_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_calendar_events" ADD CONSTRAINT "school_calendar_events_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_calendar_events" ADD CONSTRAINT "school_calendar_events_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_orientations" ADD CONSTRAINT "student_orientations_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_orientations" ADD CONSTRAINT "student_orientations_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_orientations" ADD CONSTRAINT "student_orientations_classLevelId_fkey" FOREIGN KEY ("classLevelId") REFERENCES "class_levels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orientation_recommendations" ADD CONSTRAINT "orientation_recommendations_orientationId_fkey" FOREIGN KEY ("orientationId") REFERENCES "student_orientations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orientation_recommendations" ADD CONSTRAINT "orientation_recommendations_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_group_analyses" ADD CONSTRAINT "subject_group_analyses_orientationId_fkey" FOREIGN KEY ("orientationId") REFERENCES "student_orientations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_analytics" ADD CONSTRAINT "student_analytics_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_analytics" ADD CONSTRAINT "student_analytics_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_analytics" ADD CONSTRAINT "student_analytics_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_performances" ADD CONSTRAINT "subject_performances_analyticsId_fkey" FOREIGN KEY ("analyticsId") REFERENCES "student_analytics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_performances" ADD CONSTRAINT "subject_performances_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_history" ADD CONSTRAINT "grade_history_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_history" ADD CONSTRAINT "grade_history_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_history" ADD CONSTRAINT "grade_history_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grade_history" ADD CONSTRAINT "grade_history_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subject_categories" ADD CONSTRAINT "subject_categories_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_options" ADD CONSTRAINT "config_options_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
