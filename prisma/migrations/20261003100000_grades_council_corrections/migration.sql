-- Règles des notes décidées le 2026-10-02 (docs/QUESTIONS_NOTES_MOYENNES.md) :
--   * chaque type d'évaluation est explicitement « interrogation », « devoir »,
--     « composition » ou « compétence » (grille de compétences, hors moyenne) ;
--   * motif obligatoire d'une absence justifiée ;
--   * conseil de classe validé : notes figées, coefficients gelés ;
--   * réclamation : correction proposée par l'enseignant, approuvée par la direction ;
--   * moyennes de l'établissement d'origine pour les élèves transférés.

-- CreateEnum
CREATE TYPE "EvaluationCategory" AS ENUM ('INTERROGATION', 'DEVOIR', 'COMPOSITION', 'COMPETENCE');
CREATE TYPE "GradeCorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "evaluation_types" ADD COLUMN "category" "EvaluationCategory" NOT NULL DEFAULT 'INTERROGATION';
ALTER TABLE "grades" ADD COLUMN "excuseReason" TEXT;

-- Reprise des types existants (même règle que la détection automatique utilisée
-- jusqu'ici ; l'école peut ensuite corriger) : composition → COMPOSITION,
-- devoir / DS / examen → DEVOIR. Avec la formule par défaut, une composition
-- compte comme un devoir : les moyennes ne changent pas.
UPDATE "evaluation_types"
SET "category" = 'COMPOSITION'
WHERE lower("code") IN ('comp', 'compo', 'composition')
   OR lower("name") ~ '(^|[^a-z])compositions?([^a-z]|$)';
UPDATE "evaluation_types"
SET "category" = 'DEVOIR'
WHERE "category" = 'INTERROGATION'
  AND (lower("code") IN ('ds', 'dev', 'devoir', 'exam', 'examen')
   OR lower("name") ~ '(^|[^a-z])(devoirs?|examens?)([^a-z]|$)');

-- CreateTable
CREATE TABLE "class_councils" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "validatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validatedById" TEXT NOT NULL,
    "coefficients" JSONB NOT NULL,
    "rules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "class_councils_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "grade_correction_requests" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "proposedValue" DECIMAL(5,2),
    "proposedAbsent" BOOLEAN NOT NULL DEFAULT false,
    "proposedExcused" BOOLEAN NOT NULL DEFAULT false,
    "excuseReason" TEXT,
    "reason" TEXT NOT NULL,
    "status" "GradeCorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "grade_correction_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "external_period_averages" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "average" DECIMAL(5,2) NOT NULL,
    "originSchool" TEXT NOT NULL,
    "enteredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_period_averages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "class_councils_classId_periodId_key" ON "class_councils"("classId", "periodId");
CREATE INDEX "grade_correction_requests_status_idx" ON "grade_correction_requests"("status");
CREATE INDEX "grade_correction_requests_evaluationId_studentId_idx" ON "grade_correction_requests"("evaluationId", "studentId");
CREATE UNIQUE INDEX "external_period_averages_studentId_periodId_key" ON "external_period_averages"("studentId", "periodId");

-- AddForeignKey
ALTER TABLE "class_councils" ADD CONSTRAINT "class_councils_classId_fkey" FOREIGN KEY ("classId") REFERENCES "classes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "class_councils" ADD CONSTRAINT "class_councils_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "grade_correction_requests" ADD CONSTRAINT "grade_correction_requests_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "grade_correction_requests" ADD CONSTRAINT "grade_correction_requests_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "external_period_averages" ADD CONSTRAINT "external_period_averages_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "external_period_averages" ADD CONSTRAINT "external_period_averages_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Données rattachées à un élève : mêmes règles d'isolement que "grades" (audit M2).
ALTER TABLE "grade_correction_requests" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "grade_correction_requests" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "grade_correction_requests"
  USING (app_rls_bypass() OR "studentId" IN (SELECT sp."id" FROM "student_profiles" sp WHERE sp."schoolId" = ANY (app_school_ids())))
  WITH CHECK (app_rls_bypass() OR "studentId" IN (SELECT sp."id" FROM "student_profiles" sp WHERE sp."schoolId" = ANY (app_school_ids())));

ALTER TABLE "external_period_averages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "external_period_averages" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "external_period_averages"
  USING (app_rls_bypass() OR "studentId" IN (SELECT sp."id" FROM "student_profiles" sp WHERE sp."schoolId" = ANY (app_school_ids())))
  WITH CHECK (app_rls_bypass() OR "studentId" IN (SELECT sp."id" FROM "student_profiles" sp WHERE sp."schoolId" = ANY (app_school_ids())));
