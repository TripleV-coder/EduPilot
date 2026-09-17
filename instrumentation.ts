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

    // Arrêt propre (Lot 7) — enregistré AVANT tout le reste. Le préchargement
    // du serveur ferme les connexions et attend les requêtes en cours ; c'est
    // ici que l'application déclare ce qu'elle veut refermer ensuite. Rien de
    // ce qui suit ne doit pouvoir empêcher cet enregistrement : sans lui, un
    // arrêt laisse des connexions PostgreSQL ouvertes. Sans le préchargement
    // (développement), l'enregistrement ne fait rien.
    const [{ registerShutdownTask }, { prisma: db }, { logger: log }] = await Promise.all([
      import("./src/lib/system/shutdown"),
      import("./src/lib/prisma"),
      import("./src/lib/utils/logger"),
    ]);
    registerShutdownTask(async () => {
      await db.$disconnect();
      log.info("Connexions PostgreSQL fermées", { module: "server/shutdown" });
    });
    registerShutdownTask(async () => {
      const { closeRedis } = await import("./src/lib/cache/redis");
      await closeRedis();
      log.info("Client Redis fermé", { module: "server/shutdown" });
    });

    // RLS effective (audit M2) : refus d'un rôle PostgreSQL qui l'ignorerait.
    if (process.env.NODE_ENV === "production") {
      const { assertRlsEnforcedAtStartup } = await import("./src/lib/db/rls-guard");
      await assertRlsEnforcedAtStartup(db, (message) => log.warn(message));
    }

    const { warmCache } = await import("./src/lib/cache/warm");
    warmCache().catch(() => {});

    // Surveillance des erreurs — facultative, et chargée en dernier.
    //
    // Sentry entraîne avec lui l'instrumentation OpenTelemetry, dont les
    // modules externes (`require-in-the-middle`) ne sont pas embarqués dans la
    // sortie standalone. Une dépendance absente y faisait échouer TOUT ce
    // hook : plus de validation d'environnement, plus de garde RLS, plus de
    // fermetures à l'arrêt. Sans DSN, on ne la charge même pas ; avec DSN, un
    // échec est signalé et le serveur démarre quand même.
    if (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN) {
      try {
        const { initSentryServer } = await import("./src/lib/monitoring/sentry");
        initSentryServer();
      } catch (error) {
        log.warn("Sentry n'a pas pu être initialisé — le serveur démarre sans surveillance des erreurs.", {
          module: "monitoring/sentry",
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) return;
    try {
      const { initSentryEdge } = await import("./src/lib/monitoring/sentry");
      initSentryEdge();
    } catch {
      // Runtime Edge : pas de journal applicatif ici, et l'absence de
      // surveillance ne doit pas empêcher le middleware de tourner.
    }
  }
}

/**
 * Capture des erreurs de rendu App Router (erreurs serveur non interceptées).
 * Requis par le SDK Sentry v10 pour un monitoring complet.
 * Note : le type du bundle edge n'expose pas ces helpers — cast contrôlé.
 */
export async function onRequestError(error: unknown, request: unknown, context: unknown) {
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  try {
    const Sentry = (await import("@sentry/nextjs")) as unknown as {
      captureRequestError: (error: unknown, request: unknown, context: unknown) => void;
      flush: (timeout?: number) => Promise<boolean>;
    };
    Sentry.captureRequestError(error, request, context);
    await Sentry.flush(2000);
  } catch {
    // Surveillance indisponible : l'erreur d'origine a déjà été journalisée
    // par l'application, il n'y a rien de plus à faire ici.
  }
}
