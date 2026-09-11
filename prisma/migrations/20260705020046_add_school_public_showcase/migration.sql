-- AlterTable : champs de la vitrine publique de l'établissement (annuaire + fiche).
ALTER TABLE "schools" ADD COLUMN     "coverImage" TEXT,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicDescription" TEXT,
ADD COLUMN     "publicPhone" TEXT,
ADD COLUMN     "region" TEXT;
