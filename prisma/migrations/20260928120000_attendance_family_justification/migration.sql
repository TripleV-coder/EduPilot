-- Justificatif d'absence envoyé par la famille, en attente de validation par
-- l'établissement (recette 2026-09-28 : le parent ne pouvait pas justifier).

-- AlterTable
ALTER TABLE "attendances" ADD COLUMN     "justificationSubmittedAt" TIMESTAMP(3),
ADD COLUMN     "justificationSubmittedById" TEXT;

-- AddForeignKey
ALTER TABLE "attendances" ADD CONSTRAINT "attendances_justificationSubmittedById_fkey" FOREIGN KEY ("justificationSubmittedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

