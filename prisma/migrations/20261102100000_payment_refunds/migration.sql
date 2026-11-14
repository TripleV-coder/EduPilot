-- Remboursements tracés dans EduPilot (décision du 2026-11-02).
--
-- Un remboursement est une écriture d'extourne : une ligne de paiement au
-- montant NÉGATIF, liée au paiement remboursé. Les totaux (encaissé, reste à
-- payer, statistiques, rapports) deviennent nets sans autre changement ;
-- l'échéancier déduit chaque remboursement du paiement qu'il annule.
-- Aucune donnée existante n'est modifiée.

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "refundOfId" TEXT;

-- CreateIndex
CREATE INDEX "payments_refundOfId_idx" ON "payments"("refundOfId");

-- AddForeignKey : un paiement remboursé ne peut pas être supprimé physiquement
ALTER TABLE "payments" ADD CONSTRAINT "payments_refundOfId_fkey" FOREIGN KEY ("refundOfId") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Garde-fou : seule une extourne est négative, et une extourne l'est toujours.
-- NOT VALID : appliqué à toute nouvelle écriture, sans revalider l'historique.
ALTER TABLE "payments" ADD CONSTRAINT "payments_refund_sign_check"
  CHECK (("refundOfId" IS NULL AND "amount" >= 0) OR ("refundOfId" IS NOT NULL AND "amount" < 0)) NOT VALID;
