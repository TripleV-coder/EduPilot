-- Lot 6 (minimisation) : modules actifs par établissement.
--
-- La colonne est d'abord créée avec TOUT le catalogue par défaut : les écoles
-- existantes gardent donc l'ensemble de leurs modules (décision du
-- propriétaire du 2026-09-14) — une migration ne retire jamais d'elle-même un
-- accès en service. Le défaut est ensuite ramené au socle, qui s'applique aux
-- écoles créées après cette migration (cf. src/lib/modules/catalog.ts).
-- Aucun UPDATE : rejouable sans effet.

ALTER TABLE "schools"
  ADD COLUMN IF NOT EXISTS "enabledModules" TEXT[] NOT NULL
  DEFAULT ARRAY[
    'students','classes','grades','attendance','schedule','messaging','finance',
    'health','discipline','ai','access-control','hr','canteen','transport',
    'courses','alumni','signature'
  ]::TEXT[];

ALTER TABLE "schools"
  ALTER COLUMN "enabledModules"
  SET DEFAULT ARRAY['students','classes','grades','attendance','schedule','messaging','finance']::TEXT[];
