/**
 * Next.js instrumentation: exécuté au démarrage du serveur.
 * Utilisé pour la validation des variables d'environnement, le cache warming
 * et d'autres initialisations.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Validation des variables d'environnement — bloque le démarrage si manquantes en prod
    const { validateEnv } = await import("./src/lib/env");
    validateEnv();

    const { warmCache } = await import("./src/lib/cache/warm");
    warmCache().catch(() => {});
  }
}
