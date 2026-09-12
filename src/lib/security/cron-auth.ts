import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Authentification des tâches planifiées (audit H2/N2) :
 * `Authorization: Bearer <CRON_SECRET>`, comparé en temps constant.
 *
 * - `not-configured` : CRON_SECRET absent → l'appelant répond une erreur de
 *   configuration, jamais un accès ;
 * - `invalid` : en-tête absent, mal formé ou secret erroné ;
 * - `ok` : secret exact.
 */
export type CronAuthResult = "ok" | "invalid" | "not-configured";

function digest(value: string): Buffer {
    // Condensats de même longueur : timingSafeEqual exige des tampons égaux.
    return createHash("sha256").update(value).digest();
}

export function verifyCronSecret(
    authorization: string | null,
    secret: string | undefined = process.env.CRON_SECRET,
): CronAuthResult {
    if (!secret) return "not-configured";

    const presented = authorization?.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
    if (!presented) return "invalid";

    return timingSafeEqual(digest(presented), digest(secret)) ? "ok" : "invalid";
}
