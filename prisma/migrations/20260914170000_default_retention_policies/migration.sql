-- Lot 6 : durées de conservation par défaut (décision du propriétaire du
-- 2026-09-14, en mois ; mêmes valeurs que src/lib/security/retention-defaults.ts).
--
-- Écoles EXISTANTES : règles posées INACTIVES. Une migration ne déclenche jamais
-- d'elle-même des effacements sur une base réelle : l'école consulte l'aperçu de
-- la purge (écran Conformité), ajuste au besoin, puis active chaque règle.
-- Une règle déjà réglée par l'école (même type de donnée) est conservée telle quelle.
-- Les écoles créées ensuite reçoivent ces règles actives (createSchoolWithDefaults).
INSERT INTO "data_retention_policies" ("id", "schoolId", "dataType", "retentionPeriod", "isActive", "description", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", d."dataType", d."months", false, d."description", NOW(), NOW()
FROM "schools" s
CROSS JOIN (VALUES
    ('STUDENT_ACCOUNT', 12, 'Compte de l''élève parti : accès fermé et coordonnées effacées. Le nom et le matricule restent au registre.'),
    ('ACADEMIC_RECORDS', 60, 'Notes et bulletins : l''élève parti est entièrement anonymisé.'),
    ('MEDICAL_RECORDS', 12, 'Dossier médical de l''élève parti : effacé.'),
    ('ACCOUNTING', 120, 'Pièces comptables (OHADA) : signalées au-delà de la durée, jamais supprimées automatiquement.'),
    ('BADGE_SCAN_LOGS', 3, 'Journaux d''accès aux badges : effacés.'),
    ('AUDIT_LOGS', 60, 'Journal d''audit : effacé.')
) AS d("dataType", "months", "description")
ON CONFLICT ("schoolId", "dataType") DO NOTHING;
