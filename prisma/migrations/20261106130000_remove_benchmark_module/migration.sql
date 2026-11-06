-- Comparaison nationale entre établissements retirée (décision du 2026-11-05) :
-- aucune source de données réelle n'alimentait ses instantanés. Le module
-- « benchmark » n'existe plus dans le catalogue ; il est retiré des écoles qui
-- l'avaient (la migration 20260917140000 l'avait activé partout). Les tables
-- benchmark_* sont conservées : aucune donnée n'est supprimée.
UPDATE "schools"
SET "enabledModules" = array_remove("enabledModules", 'benchmark')
WHERE 'benchmark' = ANY("enabledModules");
