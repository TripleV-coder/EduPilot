-- Formule de calcul propre à une matière, écrite par son enseignant
-- (vide = formule de l'école). Vérifiée par l'application avant enregistrement,
-- gelée avec le conseil de classe validé.
ALTER TABLE "class_subjects" ADD COLUMN "averageFormula" VARCHAR(300);
