/**
 * Next.js instrumentation: exécuté au démarrage du serveur.
 * Utilisé pour la validation des variables d'environnement, le cache warming,
 * l'initialisation Sentry (server + edge) et la capture des erreurs de rendu.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Validation des variables d'environnement — bloque le démarrage si manquantes en prod
    const { validateEnv } = await import("./src/lib/env");
    validateEnv();

    // RLS effective (audit M2) : refus d'un rôle PostgreSQL qui l'ignorerait.
    if (process.env.NODE_ENV === "production") {
      const [{ prisma }, { assertRlsEnforcedAtStartup }, { logger }] = await Promise.all([
        import("./src/lib/prisma"),
        import("./src/lib/db/rls-guard"),
        import("./src/lib/utils/logger"),
      ]);
      await assertRlsEnforcedAtStartup(prisma, (message) => logger.warn(message));
    }

    const { initSentryServer } = await import("./src/lib/monitoring/sentry");
    initSentryServer();

    const { warmCache } = await import("./src/lib/cache/warm");
    warmCache().catch(() => {});
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    const { initSentryEdge } = await import("./src/lib/monitoring/sentry");
    initSentryEdge();
  }
}

/**
 * Capture des erreurs de rendu App Router (erreurs serveur non interceptées).
 * Requis par le SDK Sentry v10 pour un monitoring complet.
 * Note : le type du bundle edge n'expose pas ces helpers — cast contrôlé.
 */
export async function onRequestError(error: unknown, request: unknown, context: unknown) {
  const Sentry = (await import("@sentry/nextjs")) as unknown as {
    captureRequestError: (error: unknown, request: unknown, context: unknown) => void;
    flush: (timeout?: number) => Promise<boolean>;
  };
  Sentry.captureRequestError(error, request, context);
  await Sentry.flush(2000);
}
