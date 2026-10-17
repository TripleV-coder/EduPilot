-- Révocation immédiate des droits d'établissement, sur toutes les instances
-- (audit MS-01, clôture du lot 2).
--
-- `users."roleChangedAt"` (jamais écrit jusqu'ici) devient le marqueur du
-- dernier changement de droits d'un compte : rôle, école principale,
-- rattachements enseignant, appartenance à un réseau, liens parent-enfant,
-- composition d'un réseau ou d'un groupe scolaire. Le serveur relit ce
-- marqueur à chaque requête authentifiée et recalcule les droits dès qu'il
-- change. Les triggers garantissent qu'aucun chemin d'écriture (API, import,
-- script, console SQL) ne l'oublie.
--
-- Aucune table ni donnée existante n'est modifiée ou supprimée.

-- Valeur strictement croissante par compte : deux changements dans la même
-- milliseconde restent distincts.
CREATE OR REPLACE FUNCTION edupilot_mark_access_changed(user_ids TEXT[]) RETURNS void
LANGUAGE sql AS $$
  UPDATE "users"
  SET "roleChangedAt" = GREATEST(
    (clock_timestamp() AT TIME ZONE 'UTC'),
    COALESCE("roleChangedAt", 'epoch'::timestamp) + interval '1 millisecond'
  )
  WHERE "id" = ANY(user_ids);
$$;

-- Compte : rôle, rôles hybrides ou école principale modifiés
CREATE OR REPLACE FUNCTION edupilot_users_access_marker() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."role" IS DISTINCT FROM OLD."role"
     OR NEW."roles" IS DISTINCT FROM OLD."roles"
     OR NEW."schoolId" IS DISTINCT FROM OLD."schoolId" THEN
    NEW."roleChangedAt" := GREATEST(
      (clock_timestamp() AT TIME ZONE 'UTC'),
      COALESCE(OLD."roleChangedAt", 'epoch'::timestamp) + interval '1 millisecond'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "users_access_marker"
BEFORE UPDATE ON "users"
FOR EACH ROW EXECUTE FUNCTION edupilot_users_access_marker();

-- Rattachements enseignant / appartenances à un réseau (colonne userId)
CREATE OR REPLACE FUNCTION edupilot_user_link_access_marker() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM edupilot_mark_access_changed(ARRAY[OLD."userId"]);
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM edupilot_mark_access_changed(ARRAY[NEW."userId"]);
  ELSE
    PERFORM edupilot_mark_access_changed(ARRAY[OLD."userId", NEW."userId"]);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER "teacher_school_assignments_access_marker"
AFTER INSERT OR UPDATE OR DELETE ON "teacher_school_assignments"
FOR EACH ROW EXECUTE FUNCTION edupilot_user_link_access_marker();

CREATE TRIGGER "organization_memberships_access_marker"
AFTER INSERT OR UPDATE OR DELETE ON "organization_memberships"
FOR EACH ROW EXECUTE FUNCTION edupilot_user_link_access_marker();

-- Liens parent-enfant : le compte du parent
CREATE OR REPLACE FUNCTION edupilot_parent_students_access_marker() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM edupilot_mark_access_changed(ARRAY(
    SELECT "userId" FROM "parent_profiles"
    WHERE "id" IN (
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD."parentId" END,
      CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE NEW."parentId" END
    )
  ));
  RETURN NULL;
END;
$$;

CREATE TRIGGER "parent_students_access_marker"
AFTER INSERT OR UPDATE OR DELETE ON "parent_students"
FOR EACH ROW EXECUTE FUNCTION edupilot_parent_students_access_marker();

-- Élève changé d'école : l'élève et ses parents
CREATE OR REPLACE FUNCTION edupilot_student_school_access_marker() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM edupilot_mark_access_changed(ARRAY(
    SELECT NEW."userId"
    UNION
    SELECT pp."userId" FROM "parent_students" ps
    JOIN "parent_profiles" pp ON pp."id" = ps."parentId"
    WHERE ps."studentId" = NEW."id"
  ));
  RETURN NULL;
END;
$$;

CREATE TRIGGER "student_profiles_access_marker"
AFTER UPDATE OF "schoolId" ON "student_profiles"
FOR EACH ROW WHEN (OLD."schoolId" IS DISTINCT FROM NEW."schoolId")
EXECUTE FUNCTION edupilot_student_school_access_marker();

-- Enseignant : l'école de la fiche compte parmi ses écoles accessibles.
-- Création, suppression ou changement d'école (ou de compte) de la fiche.
-- Les parcours de l'application créent la fiche avec un compte neuf, mais
-- une fiche créée ou supprimée ailleurs (console, import futur) ne doit
-- pas laisser de droits périmés.
CREATE OR REPLACE FUNCTION edupilot_teacher_school_access_marker() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM edupilot_mark_access_changed(ARRAY[OLD."userId"]);
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM edupilot_mark_access_changed(ARRAY[NEW."userId"]);
  ELSIF OLD."schoolId" IS DISTINCT FROM NEW."schoolId" OR OLD."userId" IS DISTINCT FROM NEW."userId" THEN
    PERFORM edupilot_mark_access_changed(ARRAY[OLD."userId", NEW."userId"]);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER "teacher_profiles_access_marker"
AFTER INSERT OR DELETE OR UPDATE OF "schoolId", "userId" ON "teacher_profiles"
FOR EACH ROW EXECUTE FUNCTION edupilot_teacher_school_access_marker();

-- École déplacée de réseau ou de groupe scolaire : membres des réseaux
-- concernés et comptes rattachés aux écoles principales concernées
CREATE OR REPLACE FUNCTION edupilot_school_structure_access_marker() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM edupilot_mark_access_changed(ARRAY(
    SELECT "userId" FROM "organization_memberships"
    WHERE "organizationId" IN (OLD."organizationId", NEW."organizationId")
    UNION
    SELECT "id" FROM "users"
    WHERE "schoolId" IN (OLD."parentSchoolId", NEW."parentSchoolId", NEW."id")
  ));
  RETURN NULL;
END;
$$;

CREATE TRIGGER "schools_structure_access_marker"
AFTER UPDATE OF "organizationId", "parentSchoolId", "siteType" ON "schools"
FOR EACH ROW WHEN (
  OLD."organizationId" IS DISTINCT FROM NEW."organizationId"
  OR OLD."parentSchoolId" IS DISTINCT FROM NEW."parentSchoolId"
  OR OLD."siteType" IS DISTINCT FROM NEW."siteType"
)
EXECUTE FUNCTION edupilot_school_structure_access_marker();

-- Réseau activé ou désactivé : ses membres
CREATE OR REPLACE FUNCTION edupilot_organization_access_marker() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM edupilot_mark_access_changed(ARRAY(
    SELECT "userId" FROM "organization_memberships" WHERE "organizationId" = NEW."id"
  ));
  RETURN NULL;
END;
$$;

CREATE TRIGGER "organizations_access_marker"
AFTER UPDATE OF "isActive" ON "organizations"
FOR EACH ROW WHEN (OLD."isActive" IS DISTINCT FROM NEW."isActive")
EXECUTE FUNCTION edupilot_organization_access_marker();
