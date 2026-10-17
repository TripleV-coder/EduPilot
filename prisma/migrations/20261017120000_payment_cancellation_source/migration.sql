-- Origine d'une annulation de paiement (lot 3b) : échec signalé par le
-- fournisseur (PROVIDER) ou annulation manuelle par l'école (MANUAL).
-- Une confirmation authentique du fournisseur valide le paiement quelle que
-- soit l'origine ; une annulation manuelle ou d'origine inconnue (NULL, pour
-- les paiements annulés avant cette migration) déclenche en plus une alerte.
-- Migration additive : aucune donnée existante n'est modifiée.

-- CreateEnum
CREATE TYPE "PaymentCancellationSource" AS ENUM ('PROVIDER', 'MANUAL');

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "cancellationSource" "PaymentCancellationSource";

