/**
 * Arrêt propre — côté application (Lot 7).
 *
 * Le préchargement `scripts/server/graceful-shutdown.cjs` décide QUAND arrêter
 * (signal reçu, connexions fermées, requêtes en cours terminées) ; l'application
 * déclare ici CE QU'IL FAUT fermer. Les deux communiquent par un objet global,
 * parce que le préchargement est chargé avant Next et n'a pas accès aux modules
 * de l'application.
 *
 * Sans le préchargement (développement, tests), tout devient inoffensif :
 * l'enregistrement ne fait rien et `isShuttingDown()` répond `false`.
 */

interface ShutdownState {
    shuttingDown: boolean;
    inflight: number;
    tasks: Array<() => Promise<void>>;
}

function state(): ShutdownState | null {
    return (globalThis as { __edupilotShutdown?: ShutdownState }).__edupilotShutdown ?? null;
}

/** Déclare une fermeture à exécuter à l'arrêt (idempotente de préférence). */
export function registerShutdownTask(task: () => Promise<void>): void {
    state()?.tasks.push(task);
}

/** Le serveur est-il en train de s'arrêter ? */
export function isShuttingDown(): boolean {
    return state()?.shuttingDown === true;
}

/** Nombre de requêtes HTTP en cours (0 si le préchargement est absent). */
export function inflightRequests(): number {
    return state()?.inflight ?? 0;
}
