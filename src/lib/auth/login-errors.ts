/**
 * Libellés des erreurs de connexion renvoyées par `signIn("credentials")`.
 * Logique séparée de l'écran de connexion (refonte du design à venir).
 */

/** Code posé par `app/api/auth/[...nextauth]/route.ts` au-delà de la limite d'échecs. */
const RATE_LIMITED = "RateLimited";

/** Codes posés par `@/lib/auth/login-failure` (paramètre `code` de NextAuth). */
const MESSAGES_BY_CODE: Record<string, string> = {
  service_unavailable:
    "Service momentanément indisponible. Vos identifiants ne sont pas en cause : réessayez dans quelques instants.",
  invalid_2fa: "Code de vérification incorrect.",
};

export function getLoginErrorMessage(error: string, code?: string | null): string {
  if (error === RATE_LIMITED) {
    return "Trop de tentatives de connexion. Réessayez dans quelques minutes.";
  }
  if (code && MESSAGES_BY_CODE[code]) return MESSAGES_BY_CODE[code];
  return "Email ou mot de passe incorrect";
}
