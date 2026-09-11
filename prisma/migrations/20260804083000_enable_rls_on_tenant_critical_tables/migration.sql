-- RLS V1 scope: tables critiques multi-tenant
-- Les politiques restent inertes tant que l'application ne définit pas
-- `app.current_tenant_id` dans la transaction courante.

ALTER TABLE "student_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "grades" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS student_profiles_tenant_isolation ON "student_profiles";
CREATE POLICY student_profiles_tenant_isolation
ON "student_profiles"
USING (
  current_setting('app.current_tenant_id', true) IS NOT NULL
  AND "schoolId" = current_setting('app.current_tenant_id', true)
);

DROP POLICY IF EXISTS grades_tenant_isolation ON "grades";
CREATE POLICY grades_tenant_isolation
ON "grades"
USING (
  current_setting('app.current_tenant_id', true) IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "student_profiles" sp
    WHERE sp."id" = "grades"."studentId"
      AND sp."schoolId" = current_setting('app.current_tenant_id', true)
  )
);

DROP POLICY IF EXISTS payments_tenant_isolation ON "payments";
CREATE POLICY payments_tenant_isolation
ON "payments"
USING (
  current_setting('app.current_tenant_id', true) IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "student_profiles" sp
    WHERE sp."id" = "payments"."studentId"
      AND sp."schoolId" = current_setting('app.current_tenant_id', true)
  )
);
