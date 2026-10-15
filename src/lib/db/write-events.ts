/**
 * Signal « une écriture Prisma a réussi sur tel modèle », émis par le client
 * (`scoped-client.ts`) et écouté par les caches qui dépendent de ces données
 * (moyennes de classe partagées). Le client ne connaît pas les caches : pas de
 * dépendance circulaire, et un cache s'abonne sans toucher aux routes.
 *
 * Portée : le processus courant. Les écritures en SQL brut (`$executeRaw`)
 * ne sont pas signalées.
 */
type ModelWriteListener = (model: string) => void;

const listeners = new Set<ModelWriteListener>();

/** S'abonne aux écritures ; renvoie la fonction de désabonnement. */
export function onModelWrite(listener: ModelWriteListener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** Prévient les abonnés ; un abonné en erreur n'empêche jamais l'écriture. */
export function emitModelWrite(model: string): void {
    for (const listener of listeners) {
        try {
            listener(model);
        } catch {
            // Un cache défaillant ne doit pas faire échouer une écriture réussie.
        }
    }
}

const WRITE_OPERATIONS = new Set([
    "create",
    "createMany",
    "createManyAndReturn",
    "update",
    "updateMany",
    "updateManyAndReturn",
    "upsert",
    "delete",
    "deleteMany",
]);

export function isWriteOperation(operation: string): boolean {
    return WRITE_OPERATIONS.has(operation);
}
