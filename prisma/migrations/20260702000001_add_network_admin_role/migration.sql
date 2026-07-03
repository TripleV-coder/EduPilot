-- Ajout de la valeur d'enum NETWORK_ADMIN.
-- Fichier SÉPARÉ de la migration de données : PostgreSQL interdit d'utiliser
-- une valeur d'enum nouvellement ajoutée dans la même transaction.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'NETWORK_ADMIN';
