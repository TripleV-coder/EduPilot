-- Responsable légal saisi à l'inscription (sans compte). Avant : l'étape
-- « Famille » du parcours d'inscription collectait nom, lien et téléphone du
-- responsable mais ne les envoyait jamais — ils étaient perdus.
--
-- Table rattachée à un élève : même isolation par établissement que les
-- autres (cf. 20260913120000 et 20260914090000), fermée par défaut.

CREATE TABLE "student_guardians" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "student_guardians_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "student_guardians_studentId_idx" ON "student_guardians"("studentId");

ALTER TABLE "student_guardians" ADD CONSTRAINT "student_guardians_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "student_guardians" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_guardians" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "student_guardians";
CREATE POLICY tenant_isolation ON "student_guardians"
  USING (EXISTS (SELECT 1 FROM "student_profiles" sp WHERE sp."id" = "student_guardians"."studentId"
    AND ((SELECT app_rls_bypass()) OR sp."schoolId" = ANY ((SELECT app_school_ids())::text[]))))
  WITH CHECK (EXISTS (SELECT 1 FROM "student_profiles" sp WHERE sp."id" = "student_guardians"."studentId"
    AND ((SELECT app_rls_bypass()) OR sp."schoolId" = ANY ((SELECT app_school_ids())::text[]))));
