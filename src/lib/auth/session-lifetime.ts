import type { UserRole } from "@prisma/client";

/**
 * Durée des sessions (« Rester connecté », décision du 2026-11-05).
 *
 * - case non cochée : la session se ferme après 24 h SANS activité (comme
 *   avant) — la règle sûre sur un ordinateur partagé ;
 * - case cochée : 30 jours, prolongés à chaque visite — le téléphone d'un
 *   parent ne redemande plus le mot de passe chaque jour.
 *
 * Le jeton vit au plus LONG_SESSION_SECONDS (maxAge d'Auth.js) ; l'inactivité
 * de 24 h est vérifiée à chaque requête dans le callback `jwt`. La
 * déconnexion, un changement de mot de passe ou un compte désactivé ferment
 * toujours la session, quelle que soit sa durée.
 */
export const LONG_SESSION_SECONDS = 30 * 24 * 60 * 60;
export const SHORT_SESSION_SECONDS = 24 * 60 * 60;

/** Pouvoir sur toute la plateforme : jamais de session longue. */
const REMEMBER_EXCLUDED_ROLES: readonly UserRole[] = ["SUPER_ADMIN"];

/** Valeur de la case transmise par le formulaire (« true », « on », booléen…). */
export function parseRememberFlag(value: unknown): boolean {
    return value === true || value === "true" || value === "on" || value === "1";
}

export function rememberAllowed(role: UserRole): boolean {
    return !REMEMBER_EXCLUDED_ROLES.includes(role);
}

/**
 * Un jeton émis avant cette règle n'a pas de `lastSeenAt` : son expiration
 * (`exp`) a été calculée avec l'ancienne durée de 24 h, il ne peut donc pas
 * la dépasser ; il reçoit `lastSeenAt` à sa prochaine requête.
 */
export function isSessionExpiredByInactivity(
    token: { remember?: unknown; lastSeenAt?: unknown },
    nowSeconds: number,
): boolean {
    if (token.remember === true || typeof token.lastSeenAt !== "number") return false;
    return nowSeconds - token.lastSeenAt > SHORT_SESSION_SECONDS;
}
