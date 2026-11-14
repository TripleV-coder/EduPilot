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
    const [{ registerShutdownTask }, { prisma: db }, { logger: log }, jobs] = await Promise.all([
      import("./src/lib/system/shutdown"),
      import("./src/lib/prisma"),
      import("./src/lib/utils/logger"),
      import("./src/lib/jobs/queue"),
    ]);
    registerShutdownTask(async () => {
      // Les fermetures tournent en parallèle : le passage en cours de la file
      // doit finir d'écrire avant que PostgreSQL ne soit déconnecté.
      await jobs.stopJobWorker();
      await db.$disconnect();
      log.info("Connexions PostgreSQL fermées", { module: "server/shutdown" });
    });
    registerShutdownTask(async () => {
      const { closeCache } = await import("./src/lib/cache/service");
      await closeCache();
    });

    // RLS effective (audit M2) : refus d'un rôle PostgreSQL qui l'ignorerait.
    if (process.env.NODE_ENV === "production") {
      const { assertRlsEnforcedAtStartup } = await import("./src/lib/db/rls-guard");
      await assertRlsEnforcedAtStartup(db, (message) => log.warn(message));
    }

    // Installation pas encore faite : le jeton (dérivé du secret maître) est
    // donné à l'exploitant dans ce journal, plus de variable à définir.
    if (process.env.NODE_ENV === "production") {
      const { logPendingSetup } = await import("./src/lib/auth/setup-token");
      const { prismaBase } = await import("./src/lib/prisma");
      await logPendingSetup(() => prismaBase.user.count(), (message) => log.warn(message)).catch(() => {});
    }

    // Réglages e-mail / SMS / voix / WhatsApp saisis dans la console root (relus toutes les 30 s)
    const { startIntegrationSettingsRefresh } = await import("./src/lib/system/integration-settings");
    await startIntegrationSettingsRefresh();
    if (process.env.NODE_ENV === "production" && process.env.SKIP_ENV_VALIDATION !== "true") {
      const { emailEnv, resolveEmailProvider } = await import("./src/lib/email");
      if (!resolveEmailProvider() || !emailEnv().EMAIL_FROM?.trim()) {
        log.warn(
          "E-mail non configuré : les réinitialisations de mot de passe ne partiront pas. " +
            "Le régler dans la console root › Intégrations › E-mail.",
        );
      }
    }

    const { warmCache } = await import("./src/lib/cache/warm");
    warmCache().catch(() => {});

    // File d'envoi (e-mails, SMS) : traitée par ce processus. JOB_WORKER_DISABLED=true
    // pour la confier à un autre processus pointant sur la même base.
    if (process.env.JOB_WORKER_DISABLED !== "true") {
      jobs.startJobWorker();
    }

    // Notifications push (Lot F) : toute notification créée part aussi vers les
    // appareils abonnés de son destinataire, via la file ci-dessus. Écouteur
    // inscrit dans tous les processus web (là où les notifications naissent).
    const { registerPushDispatch } = await import("./src/lib/push/dispatch");
    registerPushDispatch();
  }
}

/**
 * Erreurs de rendu et de route non interceptées (App Router) : inscrites au
 * journal des erreurs, avec alerte aux super-administrateurs (remplace
 * Sentry, 2026-11-08). Les erreurs 500 des routes API passant par
 * createApiHandler y sont inscrites par le gestionnaire lui-même.
 */
export async function onRequestError(error: unknown, request: { path?: string } | unknown) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { recordError, serverErrorReport } = await import("./src/lib/monitoring/error-journal");
    const path = (request as { path?: string } | null)?.path ?? null;
    await recordError(serverErrorReport(error, path));
  } catch {
    // Journal indisponible : l'erreur d'origine a déjà été écrite par Next
  }
}
