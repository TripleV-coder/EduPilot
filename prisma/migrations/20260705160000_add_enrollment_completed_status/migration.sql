-- AlterEnum: statut COMPLETED pour EnrollmentStatus.
-- Utilisé par le moteur de promotion pour clôturer l'inscription de l'année
-- source (l'élève ne conserve qu'une seule inscription ACTIVE, sur l'année cible).
ALTER TYPE "EnrollmentStatus" ADD VALUE 'COMPLETED';
