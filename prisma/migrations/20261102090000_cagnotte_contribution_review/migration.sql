-- Contributions aux cagnottes validées par l'école (TD-019).
--
-- Une famille DÉCLARE une contribution (espèces, référence Mobile Money) ; elle
-- ne compte dans la collecte qu'après confirmation par le comptable ou la
-- direction. Les contributions existantes n'ont jamais été vérifiées : elles
-- passent « en attente » (valeur par défaut de la colonne) et apparaissent dans
-- la file de validation de l'école, plutôt que d'être tenues pour encaissées.
-- Aucune ligne n'est supprimée.

-- CreateEnum
CREATE TYPE "CagnotteContributionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- AlterEnum


ALTER TYPE "CagnotteJournalKind" ADD VALUE 'CONTRIBUTION_DECLARED';
ALTER TYPE "CagnotteJournalKind" ADD VALUE 'CONTRIBUTION_REJECTED';

-- AlterTable
ALTER TABLE "cagnotte_contributions" ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedById" TEXT,
ADD COLUMN     "status" "CagnotteContributionStatus" NOT NULL DEFAULT 'PENDING';

-- CreateIndex
CREATE INDEX "cagnotte_contributions_cagnotteId_status_idx" ON "cagnotte_contributions"("cagnotteId", "status");

-- AddForeignKey
ALTER TABLE "cagnotte_contributions" ADD CONSTRAINT "cagnotte_contributions_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

