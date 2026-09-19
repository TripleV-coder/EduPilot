-- AlterTable: lien optionnel Alumni -> StudentProfile (dossier élève d'origine).
-- Renseigné par le moteur de promotion lors du passage au diplôme, pour
-- réconcilier l'annuaire alumni avec le dossier scolaire. ON DELETE SET NULL
-- conserve l'historique alumni même si l'élève est supprimé.
ALTER TABLE "alumni" ADD COLUMN     "studentId" TEXT;

-- CreateIndex
CREATE INDEX "alumni_studentId_idx" ON "alumni"("studentId");

-- AddForeignKey
ALTER TABLE "alumni" ADD CONSTRAINT "alumni_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "student_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
