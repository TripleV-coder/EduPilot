-- Paiements (lot S1, souveraineté des écoles) : l'élève et le frais d'un
-- paiement relèvent toujours du même établissement, quel que soit le rôle de
-- l'auteur (SUPER_ADMIN compris) et même par écriture SQL directe.
--
-- - Création d'un paiement, ou changement de son élève ou de son frais :
--   refusés si l'élève et le frais sont d'écoles différentes.
-- - Rattachement scolaire (schoolId) d'une fiche élève ou d'un frais : non
--   modifiable dès qu'un paiement y est lié, quel que soit son statut (annulé,
--   expiré, supprimé logiquement compris). Sans paiement ni plan, le
--   changement reste soumis aux seules autres règles.
--
-- Concurrence : la création (ou le changement d'élève ou de frais) verrouille
-- en partage la fiche élève et le frais avant de comparer leurs écoles, comme
-- le garde-fou des plans (lot 3d). Un changement d'école concurrent attend la
-- fin de la création et voit alors le paiement, ou la création attend le
-- changement et voit la nouvelle école.
--
-- Données existantes : aucune n'est modifiée et la migration ne les contrôle
-- pas. Un paiement historique incohérent est conservé ; ses changements de
-- statut, de notes ou de rapprochement restent possibles (le contrôle ne vise
-- que l'élève et le frais). Fonctions et triggers propres à ce lot : ceux des
-- plans de paiement (20261017140000) ne sont pas modifiés.

CREATE OR REPLACE FUNCTION edupilot_student_fee_same_school(student_id TEXT, fee_id TEXT) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT (SELECT "schoolId" FROM "student_profiles" WHERE "id" = student_id)
         IS NOT DISTINCT FROM (SELECT "schoolId" FROM "fees" WHERE "id" = fee_id);
$$;

CREATE OR REPLACE FUNCTION edupilot_payment_school_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."studentId" = NEW."studentId" AND OLD."feeId" = NEW."feeId" THEN
    RETURN NEW;
  END IF;
  PERFORM 1 FROM "student_profiles" WHERE "id" = NEW."studentId" FOR SHARE;
  PERFORM 1 FROM "fees" WHERE "id" = NEW."feeId" FOR SHARE;
  IF NOT edupilot_student_fee_same_school(NEW."studentId", NEW."feeId") THEN
    RAISE EXCEPTION 'L''élève et les frais d''un paiement doivent appartenir au même établissement.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION edupilot_school_change_payment_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  payment_id TEXT;
BEGIN
  IF NEW."schoolId" IS NOT DISTINCT FROM OLD."schoolId" THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'student_profiles' THEN
    SELECT p."id" INTO payment_id FROM "payments" p WHERE p."studentId" = OLD."id" LIMIT 1;
  ELSE
    SELECT p."id" INTO payment_id FROM "payments" p WHERE p."feeId" = OLD."id" LIMIT 1;
  END IF;
  IF payment_id IS NOT NULL THEN
    RAISE EXCEPTION 'Rattachement scolaire non modifiable (% %) : des paiements y sont liés (paiement %). Une procédure de résolution explicite est nécessaire.',
      TG_TABLE_NAME, OLD."id", payment_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "payments_school_guard"
BEFORE INSERT OR UPDATE OF "studentId", "feeId" ON "payments"
FOR EACH ROW EXECUTE FUNCTION edupilot_payment_school_guard();

CREATE TRIGGER "student_profiles_payment_school_guard"
BEFORE UPDATE OF "schoolId" ON "student_profiles"
FOR EACH ROW EXECUTE FUNCTION edupilot_school_change_payment_guard();

CREATE TRIGGER "fees_payment_school_guard"
BEFORE UPDATE OF "schoolId" ON "fees"
FOR EACH ROW EXECUTE FUNCTION edupilot_school_change_payment_guard();
