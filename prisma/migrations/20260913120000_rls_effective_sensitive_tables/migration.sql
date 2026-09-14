-- Audit M2 — RLS effective sur les données sensibles (décision du propriétaire, 2026-09-13).
--
-- Contexte transmis par l'application au début de chaque transaction
-- (src/lib/db/scoped-client.ts) :
--   app.school_ids  identifiants d'établissements visibles, séparés par des virgules ;
--   app.rls_bypass  'on' pour un contexte système déclaré explicitement.
-- Sans contexte : les tables ci-dessous apparaissent vides et toute écriture
-- y est refusée (fermée par défaut).
--
-- FORCE ROW LEVEL SECURITY soumet aussi le propriétaire des tables aux
-- politiques. Seuls un superutilisateur ou un rôle BYPASSRLS y échappent :
-- l'application doit se connecter avec le rôle applicatif créé par
-- scripts/db/setup-app-role.mjs (docs/MIGRATIONS.md, section RLS).

CREATE OR REPLACE FUNCTION app_rls_bypass() RETURNS boolean
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT coalesce(current_setting('app.rls_bypass', true), '') = 'on'
$$;

CREATE OR REPLACE FUNCTION app_school_ids() RETURNS text[]
LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT string_to_array(nullif(current_setting('app.school_ids', true), ''), ',')
$$;

-- Politiques de la V1 (app.current_tenant_id, jamais positionné en pratique).
DROP POLICY IF EXISTS student_profiles_tenant_isolation ON "student_profiles";
DROP POLICY IF EXISTS grades_tenant_isolation ON "grades";
DROP POLICY IF EXISTS payments_tenant_isolation ON "payments";

-- Élèves : porteurs de l'établissement.
ALTER TABLE "student_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "student_profiles" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "student_profiles";
CREATE POLICY tenant_isolation ON "student_profiles"
  USING (app_rls_bypass() OR "schoolId" = ANY (app_school_ids()))
  WITH CHECK (app_rls_bypass() OR "schoolId" = ANY (app_school_ids()));

-- Tables rattachées à un élève. La sous-requête n'est pas corrélée : elle est
-- évaluée une fois par requête (sous-plan haché), pas une fois par ligne.
ALTER TABLE "grades" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "grades" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "grades";
CREATE POLICY tenant_isolation ON "grades"
  USING (app_rls_bypass() OR "studentId" IN (SELECT sp."id" FROM "student_profiles" sp WHERE sp."schoolId" = ANY (app_school_ids())))
  WITH CHECK (app_rls_bypass() OR "studentId" IN (SELECT sp."id" FROM "student_profiles" sp WHERE sp."schoolId" = ANY (app_school_ids())));

ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "payments";
CREATE POLICY tenant_isolation ON "payments"
  USING (app_rls_bypass() OR "studentId" IN (SELECT sp."id" FROM "student_profiles" sp WHERE sp."schoolId" = ANY (app_school_ids())))
  WITH CHECK (app_rls_bypass() OR "studentId" IN (SELECT sp."id" FROM "student_profiles" sp WHERE sp."schoolId" = ANY (app_school_ids())));

ALTER TABLE "attendances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attendances" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "attendances";
CREATE POLICY tenant_isolation ON "attendances"
  USING (app_rls_bypass() OR "studentId" IN (SELECT sp."id" FROM "student_profiles" sp WHERE sp."schoolId" = ANY (app_school_ids())))
  WITH CHECK (app_rls_bypass() OR "studentId" IN (SELECT sp."id" FROM "student_profiles" sp WHERE sp."schoolId" = ANY (app_school_ids())));

ALTER TABLE "behavior_incidents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "behavior_incidents" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "behavior_incidents";
CREATE POLICY tenant_isolation ON "behavior_incidents"
  USING (app_rls_bypass() OR "studentId" IN (SELECT sp."id" FROM "student_profiles" sp WHERE sp."schoolId" = ANY (app_school_ids())))
  WITH CHECK (app_rls_bypass() OR "studentId" IN (SELECT sp."id" FROM "student_profiles" sp WHERE sp."schoolId" = ANY (app_school_ids())));

ALTER TABLE "sanctions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sanctions" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "sanctions";
CREATE POLICY tenant_isolation ON "sanctions"
  USING (app_rls_bypass() OR "incidentId" IN (
    SELECT bi."id" FROM "behavior_incidents" bi
    JOIN "student_profiles" sp ON sp."id" = bi."studentId"
    WHERE sp."schoolId" = ANY (app_school_ids())))
  WITH CHECK (app_rls_bypass() OR "incidentId" IN (
    SELECT bi."id" FROM "behavior_incidents" bi
    JOIN "student_profiles" sp ON sp."id" = bi."studentId"
    WHERE sp."schoolId" = ANY (app_school_ids())));

ALTER TABLE "medical_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "medical_records" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "medical_records";
CREATE POLICY tenant_isolation ON "medical_records"
  USING (app_rls_bypass() OR "studentId" IN (SELECT sp."id" FROM "student_profiles" sp WHERE sp."schoolId" = ANY (app_school_ids())))
  WITH CHECK (app_rls_bypass() OR "studentId" IN (SELECT sp."id" FROM "student_profiles" sp WHERE sp."schoolId" = ANY (app_school_ids())));

-- Tables rattachées à un dossier médical.
ALTER TABLE "allergies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "allergies" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "allergies";
CREATE POLICY tenant_isolation ON "allergies"
  USING (app_rls_bypass() OR "medicalRecordId" IN (
    SELECT mr."id" FROM "medical_records" mr
    JOIN "student_profiles" sp ON sp."id" = mr."studentId"
    WHERE sp."schoolId" = ANY (app_school_ids())))
  WITH CHECK (app_rls_bypass() OR "medicalRecordId" IN (
    SELECT mr."id" FROM "medical_records" mr
    JOIN "student_profiles" sp ON sp."id" = mr."studentId"
    WHERE sp."schoolId" = ANY (app_school_ids())));

ALTER TABLE "vaccinations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "vaccinations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "vaccinations";
CREATE POLICY tenant_isolation ON "vaccinations"
  USING (app_rls_bypass() OR "medicalRecordId" IN (
    SELECT mr."id" FROM "medical_records" mr
    JOIN "student_profiles" sp ON sp."id" = mr."studentId"
    WHERE sp."schoolId" = ANY (app_school_ids())))
  WITH CHECK (app_rls_bypass() OR "medicalRecordId" IN (
    SELECT mr."id" FROM "medical_records" mr
    JOIN "student_profiles" sp ON sp."id" = mr."studentId"
    WHERE sp."schoolId" = ANY (app_school_ids())));

ALTER TABLE "emergency_contacts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "emergency_contacts" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "emergency_contacts";
CREATE POLICY tenant_isolation ON "emergency_contacts"
  USING (app_rls_bypass() OR "medicalRecordId" IN (
    SELECT mr."id" FROM "medical_records" mr
    JOIN "student_profiles" sp ON sp."id" = mr."studentId"
    WHERE sp."schoolId" = ANY (app_school_ids())))
  WITH CHECK (app_rls_bypass() OR "medicalRecordId" IN (
    SELECT mr."id" FROM "medical_records" mr
    JOIN "student_profiles" sp ON sp."id" = mr."studentId"
    WHERE sp."schoolId" = ANY (app_school_ids())));

-- Évaluations : rattachées à un établissement par la classe.
ALTER TABLE "evaluations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "evaluations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "evaluations";
CREATE POLICY tenant_isolation ON "evaluations"
  USING (app_rls_bypass() OR "classSubjectId" IN (
    SELECT cs."id" FROM "class_subjects" cs
    JOIN "classes" c ON c."id" = cs."classId"
    WHERE c."schoolId" = ANY (app_school_ids())))
  WITH CHECK (app_rls_bypass() OR "classSubjectId" IN (
    SELECT cs."id" FROM "class_subjects" cs
    JOIN "classes" c ON c."id" = cs."classId"
    WHERE c."schoolId" = ANY (app_school_ids())));
