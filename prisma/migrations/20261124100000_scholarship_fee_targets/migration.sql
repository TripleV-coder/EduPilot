-- FIN-01 (2026-11-24) : frais visés par une bourse, choisis par l'école.
-- Vide (défaut, bourses existantes) = tous les frais obligatoires de l'élève.
ALTER TABLE "scholarships" ADD COLUMN "feeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
