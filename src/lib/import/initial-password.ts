import { randomBytes } from "crypto";

/**
 * Mot de passe initial des comptes importés.
 *
 * Jamais de valeur fixe : un mot de passe partagé ("00000000") permettait à
 * quiconque de prendre le contrôle d'un compte importé avant la première
 * connexion du titulaire. On génère un secret aléatoire par compte — personne
 * ne le connaît, l'accès initial passe par « Mot de passe oublié » (email)
 * ou par une réinitialisation admin.
 */
export function generateImportPassword(): string {
    return randomBytes(18).toString("base64url");
}
