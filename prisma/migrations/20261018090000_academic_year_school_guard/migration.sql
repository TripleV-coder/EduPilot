-- Années scolaires (lot S2, souveraineté des écoles) : une année scolaire ne
-- relie que des données de SON établissement, quel que soit l'auteur et même
-- par écriture SQL directe.
--
-- Invariants :
-- A. L'année d'un frais (facultative) appartient à l'école de ce frais.
-- B. L'année d'une inscription appartient à l'école de la classe inscrite.
--
-- Écritures contrôlées, dans les deux sens :
-- - création, ou changement de l'année ou de l'école d'un frais ;
-- - création, ou changement de la classe ou de l'année d'une inscription ;
-- - changement d'école d'une année scolaire ou d'une classe : refusé s'il
--   rendait incohérent un frais ou une inscription qui y est lié.
--
-- Concurrence : la création (ou le changement de lien) verrouille en partage
-- l'année et la classe avant de comparer leurs écoles, comme les garde-fous
-- des plans (3d) et des paiements (S1) : un changement d'école concurrent
-- attend et voit le nouveau lien, ou le lien attend et voit la nouvelle école.
--
-- Données existantes : aucune n'est modifiée ni contrôlée par la migration.
-- Une ligne historique incohérente reste modifiable pour tout ce qui ne
-- touche pas ces liens ; son lien peut être corrigé vers une année (ou une
-- classe) de la bonne école, ou retiré (frais sans année), jamais remplacé
-- par un autre lien incohérent.

CREATE OR REPLACE FUNCTION edupilot_academic_year_school(year_id TEXT) RETURNS TEXT
LANGUAGE sql STABLE AS $$
  SELECT "schoolId" FROM "academic_years" WHERE "id" = year_id;
$$;

CREATE OR REPLACE FUNCTION edupilot_fee_academic_year_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."academicYearId" IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD."academicYearId" IS NOT DISTINCT FROM NEW."academicYearId"
     AND OLD."schoolId" = NEW."schoolId" THEN
    RETURN NEW;
  END IF;
  PERFORM 1 FROM "academic_years" WHERE "id" = NEW."academicYearId" FOR SHARE;
  IF edupilot_academic_year_school(NEW."academicYearId") IS DISTINCT FROM NEW."schoolId" THEN
    RAISE EXCEPTION 'L''année scolaire d''un frais doit appartenir au même établissement que ce frais.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION edupilot_enrollment_academic_year_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD."classId" = NEW."classId"
     AND OLD."academicYearId" = NEW."academicYearId" THEN
    RETURN NEW;
  END IF;
  PERFORM 1 FROM "classes" WHERE "id" = NEW."classId" FOR SHARE;
  PERFORM 1 FROM "academic_years" WHERE "id" = NEW."academicYearId" FOR SHARE;
  IF (SELECT "schoolId" FROM "classes" WHERE "id" = NEW."classId")
     IS DISTINCT FROM edupilot_academic_year_school(NEW."academicYearId") THEN
    RAISE EXCEPTION 'L''année scolaire d''une inscription doit appartenir au même établissement que sa classe.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION edupilot_academic_year_school_change_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."schoolId" IS NOT DISTINCT FROM OLD."schoolId" THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM "fees" f WHERE f."academicYearId" = OLD."id" AND f."schoolId" <> NEW."schoolId")
     OR EXISTS (
       SELECT 1 FROM "enrollments" e JOIN "classes" c ON c."id" = e."classId"
       WHERE e."academicYearId" = OLD."id" AND c."schoolId" <> NEW."schoolId"
     ) THEN
    RAISE EXCEPTION 'Établissement de l''année scolaire % non modifiable : des frais ou des inscriptions d''un autre établissement y sont liés.', OLD."id";
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION edupilot_class_school_change_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."schoolId" IS NOT DISTINCT FROM OLD."schoolId" THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM "enrollments" e JOIN "academic_years" y ON y."id" = e."academicYearId"
    WHERE e."classId" = OLD."id" AND y."schoolId" <> NEW."schoolId"
  ) THEN
    RAISE EXCEPTION 'Établissement de la classe % non modifiable : des inscriptions sur une année d''un autre établissement y sont liées.', OLD."id";
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "fees_academic_year_guard"
BEFORE INSERT OR UPDATE OF "academicYearId", "schoolId" ON "fees"
FOR EACH ROW EXECUTE FUNCTION edupilot_fee_academic_year_guard();

CREATE TRIGGER "enrollments_academic_year_guard"
BEFORE INSERT OR UPDATE OF "classId", "academicYearId" ON "enrollments"
FOR EACH ROW EXECUTE FUNCTION edupilot_enrollment_academic_year_guard();

CREATE TRIGGER "academic_years_school_change_guard"
BEFORE UPDATE OF "schoolId" ON "academic_years"
FOR EACH ROW EXECUTE FUNCTION edupilot_academic_year_school_change_guard();

CREATE TRIGGER "classes_school_change_guard"
BEFORE UPDATE OF "schoolId" ON "classes"
FOR EACH ROW EXECUTE FUNCTION edupilot_class_school_change_guard();
