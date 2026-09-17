-- Lot 6 (consentement) : de qui parle le consentement, et quelle version du
-- document a été acceptée.
--
-- `subjectUserId` : l'auteur lui-même par défaut ; l'identifiant de l'enfant
-- quand un parent répond pour lui. Non nul, sinon l'unicité laisserait passer
-- des doublons (NULL est distinct de NULL dans un index unique PostgreSQL).
-- Rejouable sans effet.

ALTER TABLE "data_consents" ADD COLUMN IF NOT EXISTS "subjectUserId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "data_consents" ADD COLUMN IF NOT EXISTS "version" TEXT;

UPDATE "data_consents" SET "subjectUserId" = "userId" WHERE "subjectUserId" = '';

DROP INDEX IF EXISTS "data_consents_userId_consentType_key";
CREATE UNIQUE INDEX IF NOT EXISTS "data_consents_userId_consentType_subjectUserId_key"
  ON "data_consents" ("userId", "consentType", "subjectUserId");
CREATE INDEX IF NOT EXISTS "data_consents_subjectUserId_consentType_idx"
  ON "data_consents" ("subjectUserId", "consentType");
