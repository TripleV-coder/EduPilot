-- Calcul adapté pour un élève (décision de l'enseignant de la matière) :
--   * une note précise peut ne pas être comptée pour cet élève (motif) ;
--   * une formule particulière peut remplacer la formule de la matière pour
--     cet élève, dans une période (motif). Les deux sont figés au conseil.

-- AlterTable
ALTER TABLE "grades" ADD COLUMN "excludedReason" VARCHAR(300);

-- CreateTable
CREATE TABLE "student_formulas" (
    "id" TEXT NOT NULL,
    "classSubjectId" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "formula" VARCHAR(300) NOT NULL,
    "reason" VARCHAR(300) NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_formulas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_formulas_classSubjectId_periodId_studentId_key" ON "student_formulas"("classSubjectId", "periodId", "studentId");
CREATE INDEX "student_formulas_studentId_idx" ON "student_formulas"("studentId");
CREATE INDEX "student_formulas_periodId_idx" ON "student_formulas"("periodId");

-- AddForeignKey
ALTER TABLE "student_formulas" ADD CONSTRAINT "student_formulas_classSubjectId_fkey" FOREIGN KEY ("classSubjectId") REFERENCES "class_subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_formulas" ADD CONSTRAINT "student_formulas_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_formulas" ADD CONSTRAINT "student_formulas_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Isolation par établissement (même règle que les autres données d'élève)
ALTER TABLE "student_formulas" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_formulas" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "student_formulas"
  USING (app_rls_bypass() OR "studentId" IN (SELECT sp."id" FROM "student_profiles" sp WHERE sp."schoolId" = ANY (app_school_ids())))
  WITH CHECK (app_rls_bypass() OR "studentId" IN (SELECT sp."id" FROM "student_profiles" sp WHERE sp."schoolId" = ANY (app_school_ids())));
