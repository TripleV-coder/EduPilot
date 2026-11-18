import { createHash, timingSafeEqual } from "node:crypto";
import { resolveSecret } from "@/lib/security/derived-secrets";

/**
 * Jeton d'installation (premier super-administrateur).
 *
 * Sans lui, sur une installation vierge, le PREMIER visiteur de /setup devenait
 * super-administrateur de la plateforme : une fenêtre ouverte à n'importe qui
 * entre la mise en ligne et l'installation par l'exploitant.
 *
 * - Production : jeton OBLIGATOIRE — INITIAL_SETUP_TOKEN (24 caractères au
 *   moins), ou à défaut dérivé du secret maître et écrit dans le journal du
 *   serveur au démarrage. Sans l'un ni l'autre : installation verrouillée
 *   (503), jamais ouverte par défaut.
 * - Développement et tests : exigé seulement s'il est défini.
 */
export const MIN_SETUP_TOKEN_LENGTH = 24;

export type SetupTokenPolicy =
    | { mode: "required"; expected: string }
    | { mode: "optional" }
    | { mode: "locked"; reason: string };

export function setupTokenPolicy(env: Record<string, string | undefined> = process.env): SetupTokenPolicy {
    // Production : INITIAL_SETUP_TOKEN si défini, sinon dérivé du secret maître
    // (écrit dans le journal du serveur au démarrage tant que l'installation
    // n'est pas faite — voir logPendingSetup). Hors production : seulement
    // s'il est défini (développement et tests inchangés).
    const token =
        env.NODE_ENV === "production"
            ? resolveSecret("setup", env)?.trim()
            : env.INITIAL_SETUP_TOKEN?.trim();
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

/**
 * Installation en attente (base sans aucun compte) : le jeton à saisir sur
 * /setup est écrit dans le journal du serveur, que seul l'exploitant lit.
 * Il ne sert plus à rien dès le premier compte créé (la route refuse alors
 * toute nouvelle installation) : rien n'est écrit ensuite.
 */
export async function logPendingSetup(
    countUsers: () => Promise<number>,
    log: (message: string) => void,
    env: Record<string, string | undefined> = process.env,
): Promise<void> {
    const policy = setupTokenPolicy(env);
    if (policy.mode !== "required" || env.INITIAL_SETUP_TOKEN?.trim()) return;
    if ((await countUsers()) > 0) return;
    log(`Installation en attente : ouvrez /setup et saisissez le jeton d'installation ${policy.expected}`);
}
