-- Plans de paiement (lot 3d) : un seul plan non annulé par élève et par frais,
-- et élève et frais toujours du même établissement (souveraineté des écoles,
-- quel que soit le rôle de l'auteur, SUPER_ADMIN compris).
--
-- Garde-fou en base, en plus du contrôle applicatif — y compris contre une
-- écriture SQL directe ou un chemin futur qui oublierait le contrôle :
-- - création, réactivation d'un plan annulé, changement d'élève ou de frais :
--   refusés si élève et frais sont d'écoles différentes, ou si un autre plan
--   non annulé existe déjà pour le même couple élève-frais ;
-- - plan historique INCOHÉRENT (élève et frais d'écoles différentes) : il est
--   conservé tel quel, mais toute modification financière est refusée — plan
--   (statut, total, total payé, nombre d'échéances, élève, frais) et échéances
--   (statut, montant, date, date de paiement, plan) — jusqu'à son examen ;
-- - rattachement scolaire (schoolId) d'une fiche élève ou d'un frais : non
--   modifiable dès qu'un plan de paiement, quel que soit son statut, y est lié.
--   Pour un plan cohérent, le changement le rendrait incohérent ; pour un plan
--   historique incohérent, il vaudrait résolution, qui exige une procédure
--   explicite. Sans plan lié, le changement reste libre (aucun chemin de
--   l'application ne le fait aujourd'hui).
--
-- Concurrence : le trigger des plans prend le MÊME verrou consultatif
-- transactionnel que `lockStudentFee` (hashtext('payment:' || élève || ':' ||
-- frais)), donc deux créations simultanées sont sérialisées ; le verrou est
-- réentrant dans une transaction qui le détient déjà. Une création (ou un
-- changement d'élève ou de frais) verrouille en partage la fiche élève et le
-- frais avant de comparer leurs écoles : un changement d'école concurrent
-- attend la fin de la création et voit alors le plan, ou la création attend le
-- changement et voit la nouvelle école.
--
-- Données existantes : aucune n'est modifiée. Un doublon historique cohérent
-- ne bloque ni cette migration ni les mises à jour ordinaires (recalcul du
-- total payé et du statut). Un index unique partiel n'est pas utilisé : Prisma
-- ne sait pas le déclarer (écart signalé par le contrôle de dérive) et des
-- doublons existants feraient échouer la migration. Les suppressions ne sont
-- pas visées (cascades depuis une école, un élève ou un frais).

CREATE OR REPLACE FUNCTION edupilot_payment_plan_couple_coherent(student_id TEXT, fee_id TEXT) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT (SELECT "schoolId" FROM "student_profiles" WHERE "id" = student_id)
         IS NOT DISTINCT FROM (SELECT "schoolId" FROM "fees" WHERE "id" = fee_id);
$$;

CREATE OR REPLACE FUNCTION edupilot_payment_plan_unique_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Plan historique incohérent : conservé, aucune modification financière
  IF TG_OP = 'UPDATE' AND NOT edupilot_payment_plan_couple_coherent(OLD."studentId", OLD."feeId") THEN
    RAISE EXCEPTION 'Plan de paiement % incohérent (élève et frais d''établissements différents) : modification financière refusée, plan à examiner.', OLD."id";
  END IF;
  IF TG_OP = 'INSERT' OR OLD."studentId" <> NEW."studentId" OR OLD."feeId" <> NEW."feeId" THEN
    PERFORM 1 FROM "student_profiles" WHERE "id" = NEW."studentId" FOR SHARE;
    PERFORM 1 FROM "fees" WHERE "id" = NEW."feeId" FOR SHARE;
    IF NOT edupilot_payment_plan_couple_coherent(NEW."studentId", NEW."feeId") THEN
      RAISE EXCEPTION 'L''élève et les frais d''un plan de paiement doivent appartenir au même établissement.';
    END IF;
  END IF;

  IF NEW."status" = 'CANCELLED' THEN
    RETURN NEW;
  END IF;
  -- Mise à jour d'un plan déjà en vigueur, sur le même couple : pas une création
  IF TG_OP = 'UPDATE'
     AND OLD."status" <> 'CANCELLED'
     AND OLD."studentId" = NEW."studentId"
     AND OLD."feeId" = NEW."feeId" THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('payment:' || NEW."studentId" || ':' || NEW."feeId"));
  IF EXISTS (
    SELECT 1 FROM "payment_plans"
    WHERE "studentId" = NEW."studentId"
      AND "feeId" = NEW."feeId"
      AND "status" <> 'CANCELLED'
      AND "id" <> NEW."id"
  ) THEN
    RAISE EXCEPTION 'Un plan de paiement non annulé existe déjà pour cet élève et ce frais (plan %).', NEW."id";
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION edupilot_installment_incoherent_plan_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  plan_id TEXT;
BEGIN
  FOREACH plan_id IN ARRAY (
    CASE WHEN TG_OP = 'INSERT' THEN ARRAY[NEW."paymentPlanId"]
         ELSE ARRAY[OLD."paymentPlanId", NEW."paymentPlanId"] END
  ) LOOP
    IF EXISTS (
      SELECT 1 FROM "payment_plans" pp
      WHERE pp."id" = plan_id
        AND NOT edupilot_payment_plan_couple_coherent(pp."studentId", pp."feeId")
    ) THEN
      RAISE EXCEPTION 'Plan de paiement % incohérent (élève et frais d''établissements différents) : modification de ses échéances refusée, plan à examiner.', plan_id;
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION edupilot_school_change_payment_plan_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  plan_id TEXT;
BEGIN
  IF NEW."schoolId" IS NOT DISTINCT FROM OLD."schoolId" THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'student_profiles' THEN
    SELECT pp."id" INTO plan_id FROM "payment_plans" pp WHERE pp."studentId" = OLD."id" LIMIT 1;
  ELSE
    SELECT pp."id" INTO plan_id FROM "payment_plans" pp WHERE pp."feeId" = OLD."id" LIMIT 1;
  END IF;
  IF plan_id IS NOT NULL THEN
    RAISE EXCEPTION 'Rattachement scolaire non modifiable (% %) : des plans de paiement y sont liés (plan %). Une procédure de résolution explicite est nécessaire.',
      TG_TABLE_NAME, OLD."id", plan_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "payment_plans_unique_guard"
BEFORE INSERT OR UPDATE OF "status", "studentId", "feeId", "totalAmount", "paidAmount", "installments" ON "payment_plans"
FOR EACH ROW EXECUTE FUNCTION edupilot_payment_plan_unique_guard();

CREATE TRIGGER "installment_payments_incoherent_plan_guard"
BEFORE INSERT OR UPDATE OF "status", "amount", "dueDate", "paidAt", "paymentPlanId" ON "installment_payments"
FOR EACH ROW EXECUTE FUNCTION edupilot_installment_incoherent_plan_guard();

CREATE TRIGGER "student_profiles_school_change_guard"
BEFORE UPDATE OF "schoolId" ON "student_profiles"
FOR EACH ROW EXECUTE FUNCTION edupilot_school_change_payment_plan_guard();

CREATE TRIGGER "fees_school_change_guard"
BEFORE UPDATE OF "schoolId" ON "fees"
FOR EACH ROW EXECUTE FUNCTION edupilot_school_change_payment_plan_guard();
