/**
 * Libellés des erreurs de connexion renvoyées par `signIn("credentials")`.
 * Logique séparée de l'écran de connexion (refonte du design à venir).
 */

/** Code posé par `app/api/auth/[...nextauth]/route.ts` au-delà de la limite d'échecs. */
const RATE_LIMITED = "RateLimited";

export function getLoginErrorMessage(error: string): string {
  if (error === RATE_LIMITED) {
    return "Trop de tentatives de connexion. Réessayez dans quelques minutes.";
  }
  return "Email ou mot de passe incorrect";
}
