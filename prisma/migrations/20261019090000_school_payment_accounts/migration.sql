-- Comptes marchands indépendants par école (S7, ADR-0011).
--
-- Chaque école encaisse sur SON compte marchand ; aucun compte global ne sert
-- de repli. Cette migration crée la table des comptes et le lien immuable
-- paiement → compte. Aucune donnée existante n'est modifiée : les paiements
-- antérieurs gardent paymentAccountId vide (provenance non falsifiée).

-- CreateEnum
CREATE TYPE "PaymentAccountEnvironment" AS ENUM ('SANDBOX', 'LIVE');

-- CreateEnum
CREATE TYPE "PaymentAccountStatus" AS ENUM ('INACTIVE', 'ACTIVE', 'REVOKED');

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "paymentAccountId" TEXT;

-- CreateTable
CREATE TABLE "school_payment_accounts" (
    "id" TEXT NOT NULL,
    "schoolId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'FEDAPAY',
    "environment" "PaymentAccountEnvironment" NOT NULL,
    "status" "PaymentAccountStatus" NOT NULL DEFAULT 'INACTIVE',
    "secretKeyCiphertext" TEXT NOT NULL,
    "webhookSecretCiphertext" TEXT NOT NULL,
    "encryptionKeyVersion" INTEGER NOT NULL,
    "secretKeyLast4" TEXT NOT NULL,
    "lastVerifiedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "school_payment_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "school_payment_accounts_schoolId_provider_environment_statu_idx" ON "school_payment_accounts"("schoolId", "provider", "environment", "status");

-- CreateIndex
CREATE INDEX "payments_paymentAccountId_idx" ON "payments"("paymentAccountId");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "school_payment_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_payment_accounts" ADD CONSTRAINT "school_payment_accounts_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "school_payment_accounts" ADD CONSTRAINT "school_payment_accounts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ── Garde-fous ──────────────────────────────────────────────────────────────

-- Seul FedaPay est pris en charge par école (les autres fournisseurs
-- n'existent qu'en configuration globale, désormais refusée aux écoles).
ALTER TABLE "school_payment_accounts"
  ADD CONSTRAINT "school_payment_accounts_provider_check" CHECK ("provider" IN ('FEDAPAY'));

-- Au plus un compte actif par école, fournisseur et environnement.
CREATE UNIQUE INDEX "school_payment_accounts_one_active"
  ON "school_payment_accounts" ("schoolId", "provider", "environment")
  WHERE "status" = 'ACTIVE';

-- Un compte ne change jamais d'école, de fournisseur ni d'environnement, et
-- un compte révoqué ne revient pas (nouvelle clé = nouveau compte).
CREATE OR REPLACE FUNCTION edupilot_payment_account_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."schoolId" IS DISTINCT FROM OLD."schoolId"
     OR NEW."provider" IS DISTINCT FROM OLD."provider"
     OR NEW."environment" IS DISTINCT FROM OLD."environment" THEN
    RAISE EXCEPTION 'Compte marchand %, école, fournisseur et environnement non modifiables.', OLD."id";
  END IF;
  IF OLD."status" = 'REVOKED' AND NEW."status" IS DISTINCT FROM 'REVOKED' THEN
    RAISE EXCEPTION 'Compte marchand % révoqué : il ne peut pas être réactivé (enregistrez un nouveau compte).', OLD."id";
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "school_payment_accounts_guard"
BEFORE UPDATE ON "school_payment_accounts"
FOR EACH ROW EXECUTE FUNCTION edupilot_payment_account_guard();

-- Paiement : le compte appartient à l'école du frais (verrou en partage sur le
-- compte et le frais, comme les garde-fous S1) ; une fois posé, le lien ne
-- change plus.
CREATE OR REPLACE FUNCTION edupilot_payment_account_link_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  account_school TEXT;
  fee_school TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD."paymentAccountId" IS NOT NULL AND NEW."paymentAccountId" IS DISTINCT FROM OLD."paymentAccountId" THEN
      RAISE EXCEPTION 'Paiement % : son compte marchand n''est pas modifiable.', OLD."id";
    END IF;
    IF NEW."paymentAccountId" IS NOT DISTINCT FROM OLD."paymentAccountId" AND NEW."feeId" = OLD."feeId" THEN
      RETURN NEW;
    END IF;
  END IF;
  IF NEW."paymentAccountId" IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT "schoolId" INTO account_school FROM "school_payment_accounts" WHERE "id" = NEW."paymentAccountId" FOR SHARE;
  SELECT "schoolId" INTO fee_school FROM "fees" WHERE "id" = NEW."feeId" FOR SHARE;
  IF account_school IS DISTINCT FROM fee_school THEN
    RAISE EXCEPTION 'Paiement : le compte marchand doit appartenir à l''établissement des frais.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "payments_account_link_guard"
BEFORE INSERT OR UPDATE OF "paymentAccountId", "feeId" ON "payments"
FOR EACH ROW EXECUTE FUNCTION edupilot_payment_account_link_guard();

-- ── Isolation (RLS) : une école ne voit que ses comptes ─────────────────────
ALTER TABLE "school_payment_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "school_payment_accounts" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON "school_payment_accounts";
CREATE POLICY tenant_isolation ON "school_payment_accounts"
  USING ((SELECT app_rls_bypass()) OR "schoolId" = ANY ((SELECT app_school_ids())::text[]))
  WITH CHECK ((SELECT app_rls_bypass()) OR "schoolId" = ANY ((SELECT app_school_ids())::text[]));
