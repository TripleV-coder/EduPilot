import type { Prisma } from "@prisma/client";

/**
 * Connexions réussies, telles qu'inscrites au journal d'audit.
 *
 * Les sessions sont des jetons JWT : la table `sessions` (héritée de
 * l'adaptateur Prisma d'Auth.js) n'est jamais alimentée. Les indicateurs
 * d'activité qui la comptaient affichaient toujours 0 — et « comptes
 * inactifs depuis 90 jours » comptait TOUS les comptes (2026-11-08).
 * `LOGIN` : ancienne écriture, conservée pour l'historique.
 */
export const LOGIN_ACTIONS = ["LOGIN_SUCCESS", "LOGIN"] as const;

/** Filtre « s'est connecté depuis `since` » sur un compte. */
export function loggedInSince(since: Date): Prisma.UserWhereInput {
    return { auditLogs: { some: { action: { in: [...LOGIN_ACTIONS] }, createdAt: { gte: since } } } };
}
