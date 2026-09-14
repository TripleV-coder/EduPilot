-- Lot 6 (N57) : `retentionPeriod` est désormais exprimé en MOIS (durées décidées
-- le 2026-09-14, dont 3 mois pour les journaux de badges). Les règles existantes
-- étaient lues en années : conversion à l'identique, aucune durée ne change.
UPDATE "data_retention_policies" SET "retentionPeriod" = "retentionPeriod" * 12;
