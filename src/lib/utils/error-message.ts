/**
 * Extrait un message d'erreur lisible depuis une valeur `unknown` (résultat
 * d'un `catch`). Gère les `Error`, les chaînes, et les objets `{ message }`.
 * Remplace l'anti-pattern `catch (e: any)` → `e.message`.
 */
export function getErrorMessage(error: unknown, fallback = "Une erreur est survenue."): string {
  if (typeof error === "string") return error || fallback;
  if (error instanceof Error) return error.message || fallback;
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message || fallback;
  }
  return fallback;
}
