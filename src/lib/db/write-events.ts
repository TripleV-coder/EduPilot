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

/**
 * Signal détaillé « des lignes ont été CRÉÉES » (create, createMany,
 * createManyAndReturn), avec les arguments et le résultat de l'opération.
 * Écouté par l'envoi des notifications push (lib/push/dispatch).
 *
 * Registre porté par `globalThis` : en production, l'instrumentation (où
 * l'écouteur s'inscrit au démarrage) et les routes (où les écritures ont lieu)
 * sont des paquets distincts, chacun avec sa copie de ce module.
 */
export interface RecordsCreatedEvent {
    model: string;
    operation: "create" | "createMany" | "createManyAndReturn";
    args: unknown;
    result: unknown;
    /** Écriture faite dans une transaction pas encore validée (annulable). */
    inTransaction: boolean;
}

type RecordsCreatedListener = (event: RecordsCreatedEvent) => void;

const CREATED_REGISTRY = Symbol.for("edupilot.db.recordsCreatedListeners");

function createdListeners(): Set<RecordsCreatedListener> {
    const registry = globalThis as unknown as Record<symbol, Set<RecordsCreatedListener> | undefined>;
    return (registry[CREATED_REGISTRY] ??= new Set());
}

/** S'abonne aux créations ; renvoie la fonction de désabonnement. */
export function onRecordsCreated(listener: RecordsCreatedListener): () => void {
    const listeners = createdListeners();
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function hasRecordsCreatedListeners(): boolean {
    return createdListeners().size > 0;
}

/** Prévient les abonnés ; un abonné en erreur n'empêche jamais l'écriture. */
export function emitRecordsCreated(event: RecordsCreatedEvent): void {
    for (const listener of createdListeners()) {
        try {
            listener(event);
        } catch {
            // Un abonné défaillant ne doit pas faire échouer une écriture réussie.
        }
    }
}

const CREATE_OPERATIONS = new Set(["create", "createMany", "createManyAndReturn"]);

export function isCreateOperation(operation: string): operation is RecordsCreatedEvent["operation"] {
    return CREATE_OPERATIONS.has(operation);
}
