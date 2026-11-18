/**
 * PostgreSQL embarqué, chargé seulement quand il sert (correction S0).
 *
 * Dès son import, `embedded-postgres` enregistre un gestionnaire d'arrêt
 * (`async-exit-hook`) qui, sur l'événement `beforeExit`, appelle
 * `process.exit(0)`. Or vitest ne force pas la sortie : il pose
 * `process.exitCode = 1` et laisse le processus se terminer. Le code explicite
 * 0 écrasait ce code d'échec : une suite en échec sortait avec 0, en local
 * comme en CI (l'import avait lieu même avec TEST_DATABASE_URL).
 *
 * - Import dynamique : rien n'est chargé quand une base est fournie.
 * - Les écouteurs `beforeExit` et `exit` ajoutés par l'import sont retirés.
 *   Le premier écrasait le code de sortie ; le second, qui ne peut rien faire
 *   d'asynchrone, lève « done is not a function » dès que le premier ne passe
 *   plus avant lui (sortie 1 même pour une suite réussie). L'arrêt du cluster
 *   est fait par le teardown du setup global ; les arrêts sur signal (SIGINT,
 *   SIGTERM…) gardent leur arrêt propre, avec un code non nul.
 */
const NEUTRALIZED_EVENTS = ["beforeExit", "exit"] as const;

export async function loadEmbeddedPostgres() {
  const existing = new Map(NEUTRALIZED_EVENTS.map((event) => [event, new Set(process.listeners(event))]));
  const { default: EmbeddedPostgres } = await import("embedded-postgres");
  for (const event of NEUTRALIZED_EVENTS) {
    for (const listener of process.listeners(event)) {
      if (!existing.get(event)!.has(listener)) process.removeListener(event, listener as (...args: unknown[]) => void);
    }
  }
  return EmbeddedPostgres;
}
