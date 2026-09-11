-- C1 : dérive entre les migrations et schema.prisma (colonne ajoutée par `db push`
-- lors de la configuration des cycles par école, jamais migrée).
-- Tableau vide = cycles non configurés = aucune restriction (api/classes/route.ts).

-- AlterTable
ALTER TABLE "schools" ADD COLUMN     "offeredLevels" "SchoolLevel"[] DEFAULT ARRAY[]::"SchoolLevel"[];
