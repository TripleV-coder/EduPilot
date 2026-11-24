-- INT-01 (2026-11-24) : matricule national EducMaster de l'élève, identifiant de
-- correspondance avec le SIGE (imprimé sur le bulletin et la carte officiels).
ALTER TABLE "student_profiles" ADD COLUMN "educmasterMatricule" TEXT;
CREATE INDEX "student_profiles_schoolId_educmasterMatricule_idx" ON "student_profiles"("schoolId", "educmasterMatricule");
-- Unique par école parmi les élèves non supprimés (une suppression logique libère le matricule)
CREATE UNIQUE INDEX "student_profiles_educmaster_unique_active"
  ON "student_profiles"("schoolId", "educmasterMatricule")
  WHERE "deletedAt" IS NULL AND "educmasterMatricule" IS NOT NULL;
