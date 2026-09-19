/**
 * Classement des échecs de connexion (audit M10).
 *
 * Avant : une base injoignable levait une erreur Prisma brute dans
 * `authorize()` ; NextAuth la transformait en `error=Configuration` et l'écran
 * affichait « Email ou mot de passe incorrect » — le support était trompé et
 * l'utilisateur doutait de son mot de passe.
 *
 * Désormais `authorize()` passe par `withSigninErrorMapping` :
 *  - panne d'infrastructure → CredentialsSignin `code=service_unavailable` ;
 *  - code 2FA erroné → CredentialsSignin `code=invalid_2fa` ;
 *  - toute autre erreur est relancée telle quelle.
 * Le `code` est placé par NextAuth dans l'URL de retour, lue par l'écran de
 * connexion (`@/lib/auth/login-errors`). Il ne révèle rien de sensible.
 *
 * Import depuis `@auth/core/errors` : même classe que celle réexportée par
 * `next-auth`, sans dépendre du runtime Next (testable hors bundler).
 */
import { CredentialsSignin } from "@auth/core/errors";
import { logger } from "@/lib/utils/logger";

export const SERVICE_UNAVAILABLE_CODE = "service_unavailable";

export class ServiceUnavailableSignin extends CredentialsSignin {
    code = SERVICE_UNAVAILABLE_CODE;
}

export class InvalidTwoFactorSignin extends CredentialsSignin {
    code = "invalid_2fa";
}

/** Erreurs Prisma qui signalent une base indisponible, pas une donnée refusée. */
const INFRASTRUCTURE_ERROR_NAMES = new Set([
    "PrismaClientInitializationError",
    "PrismaClientRustPanicError",
]);

/**
 * P1001 serveur injoignable · P1002 délai de connexion · P1008 opération
 * expirée · P1017 connexion fermée par le serveur · P2024 pool de connexions saturé.
 */
const INFRASTRUCTURE_ERROR_CODES = new Set(["P1001", "P1002", "P1008", "P1017", "P2024"]);

export function isInfrastructureError(error: unknown): boolean {
    if (!error || typeof error !== "object") return false;
    const { name, code, errorCode } = error as { name?: unknown; code?: unknown; errorCode?: unknown };
    if (typeof name === "string" && INFRASTRUCTURE_ERROR_NAMES.has(name)) return true;
    return [code, errorCode].some((value) => typeof value === "string" && INFRASTRUCTURE_ERROR_CODES.has(value));
}

export function toSigninError(error: unknown): unknown {
    if (error instanceof CredentialsSignin) return error;
    if (isInfrastructureError(error)) {
        logger.error("[auth] connexion impossible : base de données indisponible", error, { module: "auth" });
        return new ServiceUnavailableSignin();
    }
    return error;
}

/** Enveloppe `authorize()` : aucune panne n'est présentée comme des identifiants invalides. */
export function withSigninErrorMapping<Args extends unknown[], Result>(
    authorize: (...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
    return async (...args: Args) => {
        try {
            return await authorize(...args);
        } catch (error) {
            throw toSigninError(error);
        }
    };
}
