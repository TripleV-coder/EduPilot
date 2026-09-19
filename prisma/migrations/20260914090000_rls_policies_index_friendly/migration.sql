-- Audit M2 — politiques RLS réécrites pour garder les plans par index.
--
-- Mesure (base d'audit, rôle applicatif, contexte d'établissement) : avec la
-- forme « "studentId" IN (sous-requête) », le planificateur abandonnait le
-- chemin par index (classe → évaluations → notes) pour un parcours séquentiel
-- des 131 208 notes : notes d'une classe 17 ms (sans RLS) → 114 ms.
-- Forme corrélée ci-dessous (EXISTS sur la clé primaire, fonctions évaluées
-- une fois par requête) : 18 ms. Contrepartie mesurée : un agrégat sur toutes
-- les notes d'un établissement passe de 83 à 114 ms (sonde d'index par ligne).
-- Index couvrants essayés (student_profiles, classes, class_subjects) : aucun
-- gain, non ajoutés.
--
-- Mêmes règles d'accès que 20260913120000 : app.school_ids / app.rls_bypass,
-- fermée par défaut, USING et WITH CHECK identiques.

DROP POLICY IF EXISTS tenant_isolation ON "student_profiles";
CREATE POLICY tenant_isolation ON "student_profiles"
  USING ((SELECT app_rls_bypass()) OR "schoolId" = ANY ((SELECT app_school_ids())::text[]))
  WITH CHECK ((SELECT app_rls_bypass()) OR "schoolId" = ANY ((SELECT app_school_ids())::text[]));

-- Tables rattachées à un élève.
DROP POLICY IF EXISTS tenant_isolation ON "grades";
CREATE POLICY tenant_isolation ON "grades"
  USING (EXISTS (SELECT 1 FROM "student_profiles" sp WHERE sp."id" = "grades"."studentId"
    AND ((SELECT app_rls_bypass()) OR sp."schoolId" = ANY ((SELECT app_school_ids())::text[]))))
  WITH CHECK (EXISTS (SELECT 1 FROM "student_profiles" sp WHERE sp."id" = "grades"."studentId"
    AND ((SELECT app_rls_bypass()) OR sp."schoolId" = ANY ((SELECT app_school_ids())::text[]))));

DROP POLICY IF EXISTS tenant_isolation ON "payments";
CREATE POLICY tenant_isolation ON "payments"
  USING (EXISTS (SELECT 1 FROM "student_profiles" sp WHERE sp."id" = "payments"."studentId"
    AND ((SELECT app_rls_bypass()) OR sp."schoolId" = ANY ((SELECT app_school_ids())::text[]))))
  WITH CHECK (EXISTS (SELECT 1 FROM "student_profiles" sp WHERE sp."id" = "payments"."studentId"
    AND ((SELECT app_rls_bypass()) OR sp."schoolId" = ANY ((SELECT app_school_ids())::text[]))));

DROP POLICY IF EXISTS tenant_isolation ON "attendances";
CREATE POLICY tenant_isolation ON "attendances"
  USING (EXISTS (SELECT 1 FROM "student_profiles" sp WHERE sp."id" = "attendances"."studentId"
    AND ((SELECT app_rls_bypass()) OR sp."schoolId" = ANY ((SELECT app_school_ids())::text[]))))
  WITH CHECK (EXISTS (SELECT 1 FROM "student_profiles" sp WHERE sp."id" = "attendances"."studentId"
    AND ((SELECT app_rls_bypass()) OR sp."schoolId" = ANY ((SELECT app_school_ids())::text[]))));

DROP POLICY IF EXISTS tenant_isolation ON "behavior_incidents";
CREATE POLICY tenant_isolation ON "behavior_incidents"
  USING (EXISTS (SELECT 1 FROM "student_profiles" sp WHERE sp."id" = "behavior_incidents"."studentId"
    AND ((SELECT app_rls_bypass()) OR sp."schoolId" = ANY ((SELECT app_school_ids())::text[]))))
  WITH CHECK (EXISTS (SELECT 1 FROM "student_profiles" sp WHERE sp."id" = "behavior_incidents"."studentId"
    AND ((SELECT app_rls_bypass()) OR sp."schoolId" = ANY ((SELECT app_school_ids())::text[]))));

DROP POLICY IF EXISTS tenant_isolation ON "medical_records";
CREATE POLICY tenant_isolation ON "medical_records"
  USING (EXISTS (SELECT 1 FROM "student_profiles" sp WHERE sp."id" = "medical_records"."studentId"
    AND ((SELECT app_rls_bypass()) OR sp."schoolId" = ANY ((SELECT app_school_ids())::text[]))))
  WITH CHECK (EXISTS (SELECT 1 FROM "student_profiles" sp WHERE sp."id" = "medical_records"."studentId"
    AND ((SELECT app_rls_bypass()) OR sp."schoolId" = ANY ((SELECT app_school_ids())::text[]))));

-- Sanctions : rattachées à un incident.
DROP POLICY IF EXISTS tenant_isolation ON "sanctions";
CREATE POLICY tenant_isolation ON "sanctions"
  USING (EXISTS (SELECT 1 FROM "behavior_incidents" bi JOIN "student_profiles" sp ON sp."id" = bi."studentId"
    WHERE bi."id" = "sanctions"."incidentId"
    AND ((SELECT app_rls_bypass()) OR sp."schoolId" = ANY ((SELECT app_school_ids())::text[]))))
  WITH CHECK (EXISTS (SELECT 1 FROM "behavior_incidents" bi JOIN "student_profiles" sp ON sp."id" = bi."studentId"
    WHERE bi."id" = "sanctions"."incidentId"
    AND ((SELECT app_rls_bypass()) OR sp."schoolId" = ANY ((SELECT app_school_ids())::text[]))));

-- Tables rattachées à un dossier médical.
DROP POLICY IF EXISTS tenant_isolation ON "allergies";
CREATE POLICY tenant_isolation ON "allergies"
  USING (EXISTS (SELECT 1 FROM "medical_records" mr JOIN "student_profiles" sp ON sp."id" = mr."studentId"
    WHERE mr."id" = "allergies"."medicalRecordId"
    AND ((SELECT app_rls_bypass()) OR sp."schoolId" = ANY ((SELECT app_school_ids())::text[]))))
  WITH CHECK (EXISTS (SELECT 1 FROM "medical_records" mr JOIN "student_profiles" sp ON sp."id" = mr."studentId"
    WHERE mr."id" = "allergies"."medicalRecordId"
    AND ((SELECT app_rls_bypass()) OR sp."schoolId" = ANY ((SELECT app_school_ids())::text[]))));

DROP POLICY IF EXISTS tenant_isolation ON "vaccinations";
CREATE POLICY tenant_isolation ON "vaccinations"
  USING (EXISTS (SELECT 1 FROM "medical_records" mr JOIN "student_profiles" sp ON sp."id" = mr."studentId"
    WHERE mr."id" = "vaccinations"."medicalRecordId"
    AND ((SELECT app_rls_bypass()) OR sp."schoolId" = ANY ((SELECT app_school_ids())::text[]))))
  WITH CHECK (EXISTS (SELECT 1 FROM "medical_records" mr JOIN "student_profiles" sp ON sp."id" = mr."studentId"
    WHERE mr."id" = "vaccinations"."medicalRecordId"
    AND ((SELECT app_rls_bypass()) OR sp."schoolId" = ANY ((SELECT app_school_ids())::text[]))));

DROP POLICY IF EXISTS tenant_isolation ON "emergency_contacts";
CREATE POLICY tenant_isolation ON "emergency_contacts"
  USING (EXISTS (SELECT 1 FROM "medical_records" mr JOIN "student_profiles" sp ON sp."id" = mr."studentId"
    WHERE mr."id" = "emergency_contacts"."medicalRecordId"
    AND ((SELECT app_rls_bypass()) OR sp."schoolId" = ANY ((SELECT app_school_ids())::text[]))))
  WITH CHECK (EXISTS (SELECT 1 FROM "medical_records" mr JOIN "student_profiles" sp ON sp."id" = mr."studentId"
    WHERE mr."id" = "emergency_contacts"."medicalRecordId"
    AND ((SELECT app_rls_bypass()) OR sp."schoolId" = ANY ((SELECT app_school_ids())::text[]))));

-- Évaluations : rattachées à un établissement par la classe.
DROP POLICY IF EXISTS tenant_isolation ON "evaluations";
CREATE POLICY tenant_isolation ON "evaluations"
  USING (EXISTS (SELECT 1 FROM "class_subjects" cs JOIN "classes" c ON c."id" = cs."classId"
    WHERE cs."id" = "evaluations"."classSubjectId"
    AND ((SELECT app_rls_bypass()) OR c."schoolId" = ANY ((SELECT app_school_ids())::text[]))))
  WITH CHECK (EXISTS (SELECT 1 FROM "class_subjects" cs JOIN "classes" c ON c."id" = cs."classId"
    WHERE cs."id" = "evaluations"."classSubjectId"
    AND ((SELECT app_rls_bypass()) OR c."schoolId" = ANY ((SELECT app_school_ids())::text[]))));
