/**
 * Root user access control utilities
 *
 * `ROOT_USER_EMAILS` est une restriction FACULTATIVE (audit Lot 5, N36) :
 * - absente : tout SUPER_ADMIN a accès à la console root — c'est le cas d'une
 *   installation neuve, dont le premier super-administrateur est créé depuis
 *   l'interface (/setup) et doit pouvoir déployer le premier établissement ;
 * - définie : seuls les SUPER_ADMIN listés y ont accès.
 * Emails comparés sans tenir compte de la casse (/setup les enregistre en minuscules).
 */

import type { Session } from "next-auth";

const normalize = (email: string) => email.trim().toLowerCase();

const ROOT_EMAILS = (process.env.ROOT_USER_EMAILS || "").split(",").map(normalize).filter(Boolean);

/**
 * L'email figure-t-il explicitement dans ROOT_USER_EMAILS ? (Faux si la liste
 * est absente : sert à protéger les comptes root listés, pas à ouvrir l'accès.)
 */
export function isRootUserEmail(email: string | null | undefined): boolean {
    if (!email) return false;
    if (ROOT_EMAILS.length === 0) return false;
    return ROOT_EMAILS.includes(normalize(email));
}

/**
 * La session courante donne-t-elle accès à la console root ?
 * SUPER_ADMIN, et membre de ROOT_USER_EMAILS si la liste est définie.
 */
export function hasValidRootSession(session: Session | null): boolean {
    if (!session?.user) return false;
    if (session.user.role !== "SUPER_ADMIN") return false;
    if (ROOT_EMAILS.length > 0 && !isRootUserEmail(session.user.email)) return false;
    return true;
}
