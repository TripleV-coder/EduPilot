import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Jeton d'installation (premier super-administrateur).
 *
 * Sans lui, sur une installation vierge, le PREMIER visiteur de /setup devenait
 * super-administrateur de la plateforme : une fenêtre ouverte à n'importe qui
 * entre la mise en ligne et l'installation par l'exploitant.
 *
 * - Production : jeton OBLIGATOIRE (INITIAL_SETUP_TOKEN, 24 caractères au
 *   moins). Absent ou trop court : l'installation reste verrouillée (503),
 *   jamais ouverte par défaut.
 * - Développement et tests : exigé seulement s'il est défini.
 */
export const MIN_SETUP_TOKEN_LENGTH = 24;

export type SetupTokenPolicy =
    | { mode: "required"; expected: string }
    | { mode: "optional" }
    | { mode: "locked"; reason: string };

export function setupTokenPolicy(env: Record<string, string | undefined> = process.env): SetupTokenPolicy {
    const token = env.INITIAL_SETUP_TOKEN?.trim();
    if (token && token.length >= MIN_SETUP_TOKEN_LENGTH) return { mode: "required", expected: token };
    if (env.NODE_ENV === "production") {
        return {
            mode: "locked",
            reason: token
                ? `INITIAL_SETUP_TOKEN trop court (${MIN_SETUP_TOKEN_LENGTH} caractères au moins).`
                : "INITIAL_SETUP_TOKEN n'est pas défini sur le serveur.",
        };
    }
    // Hors production, un jeton défini mais trop court est tout de même exigé
    if (token) return { mode: "required", expected: token };
    return { mode: "optional" };
}

/** Comparaison à temps constant (empreintes de même longueur). */
export function setupTokenMatches(provided: unknown, expected: string): boolean {
    if (typeof provided !== "string" || provided.length === 0) return false;
    const a = createHash("sha256").update(provided.trim()).digest();
    const b = createHash("sha256").update(expected).digest();
    return timingSafeEqual(a, b);
}
