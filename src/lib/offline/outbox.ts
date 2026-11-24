/**
 * File d'attente hors ligne (OFF-01, 2026-11-24).
 *
 * Quand le réseau tombe, l'appel et une nouvelle saisie de notes sont gardés
 * sur l'appareil, puis envoyés dès son retour. Règles :
 * 1. Chaque opération porte une clé d'idempotence (UUID) : un renvoi après une
 *    réponse perdue ne crée rien en double (serveur : Evaluation.clientKey ;
 *    appel et notes sont des mises à jour par élève).
 * 2. Une opération appartient à un utilisateur et à une école : seul son
 *    auteur la renvoie, avec sa session. La file est vidée à la déconnexion
 *    (appareils partagés), après confirmation s'il reste des envois.
 * 3. Refus définitif du serveur (règle métier, droits, 4xx) : l'opération est
 *    gardée « refusée » avec le message, montrée à l'utilisateur, jamais
 *    renvoyée en boucle ni effacée en silence. Réseau, 5xx, 408, 429, 401 :
 *    nouvel essai plus tard.
 * 4. Jamais de paiement hors ligne : seul le serveur, sur confirmation du
 *    fournisseur, établit un encaissement.
 * Stockage abstrait (OutboxStore) : IndexedDB dans le navigateur, mémoire en test.
 */

export type OutboxKind = "attendance" | "grades";

export interface OutboxOp {
    /** Clé d'idempotence, aussi identifiant de l'opération. */
    id: string;
    userId: string;
    schoolId: string | null;
    kind: OutboxKind;
    /** Libellé pour l'utilisateur (« Appel 6e A du 24/11 »). */
    label: string;
    payload: unknown;
    createdAt: number;
    attempts: number;
    status: "queued" | "rejected";
    lastError?: string;
}

export interface OutboxStore {
    all(): Promise<OutboxOp[]>;
    put(op: OutboxOp): Promise<void>;
    delete(id: string): Promise<void>;
    clear(): Promise<void>;
}

export type SendOutcome = "done" | "retry" | { rejected: string };

export const OUTBOX_CHANGED_EVENT = "edupilot:outbox-changed";

function notifyChanged(): void {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(OUTBOX_CHANGED_EVENT));
}

/** Classement d'une réponse HTTP : succès, à réessayer, ou refus définitif. */
export async function classifyResponse(res: Response): Promise<SendOutcome> {
    if (res.ok) return "done";
    if (res.status >= 500 || [401, 408, 425, 429].includes(res.status)) return "retry";
    const body = await res.json().catch(() => ({}) as { error?: unknown });
    const message = typeof (body as { error?: unknown }).error === "string" ? (body as { error: string }).error : `Refusé (${res.status})`;
    return { rejected: message };
}

/** Erreur réseau (fetch rejeté) : l'appareil est hors ligne ou le serveur injoignable. */
export function isNetworkError(error: unknown): boolean {
    return error instanceof TypeError;
}

export async function enqueue(store: OutboxStore, op: Omit<OutboxOp, "createdAt" | "attempts" | "status">): Promise<OutboxOp> {
    const full: OutboxOp = { ...op, createdAt: Date.now(), attempts: 0, status: "queued" };
    await store.put(full);
    notifyChanged();
    return full;
}

export async function pendingFor(store: OutboxStore, userId: string): Promise<OutboxOp[]> {
    return (await store.all()).filter((op) => op.userId === userId).sort((a, b) => a.createdAt - b.createdAt);
}

/**
 * Envoie, dans l'ordre de saisie, les opérations en attente de l'utilisateur.
 * S'arrête au premier « à réessayer » (réseau encore absent). Renvoie le bilan.
 */
export async function flushOutbox(
    store: OutboxStore,
    userId: string,
    send: (op: OutboxOp) => Promise<SendOutcome>,
): Promise<{ sent: number; rejected: number; remaining: number }> {
    let sent = 0;
    let rejected = 0;
    for (const op of await pendingFor(store, userId)) {
        if (op.status === "rejected") continue;
        let outcome: SendOutcome;
        try {
            outcome = await send(op);
        } catch (error) {
            outcome = isNetworkError(error) ? "retry" : { rejected: error instanceof Error ? error.message : String(error) };
        }
        if (outcome === "done") {
            await store.delete(op.id);
            sent += 1;
        } else if (outcome === "retry") {
            await store.put({ ...op, attempts: op.attempts + 1 });
            break;
        } else {
            await store.put({ ...op, attempts: op.attempts + 1, status: "rejected", lastError: outcome.rejected });
            rejected += 1;
        }
    }
    const remaining = (await pendingFor(store, userId)).length;
    if (sent || rejected) notifyChanged();
    return { sent, rejected, remaining };
}

export async function discard(store: OutboxStore, id: string): Promise<void> {
    await store.delete(id);
    notifyChanged();
}

export function memoryStore(): OutboxStore {
    const rows = new Map<string, OutboxOp>();
    return {
        all: async () => [...rows.values()].map((op) => ({ ...op })),
        put: async (op) => void rows.set(op.id, { ...op }),
        delete: async (id) => void rows.delete(id),
        clear: async () => rows.clear(),
    };
}

const DB_NAME = "edupilot-offline";
const STORE = "outbox";

/** Stockage IndexedDB (navigateur). Lève si IndexedDB est indisponible. */
export function indexedDbStore(): OutboxStore {
    const open = () =>
        new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = () => {
                if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE, { keyPath: "id" });
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    const run = async <T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
        const db = await open();
        try {
            return await new Promise<T>((resolve, reject) => {
                const tx = db.transaction(STORE, mode);
                const request = work(tx.objectStore(STORE));
                tx.oncomplete = () => resolve(request.result);
                tx.onerror = () => reject(tx.error);
                tx.onabort = () => reject(tx.error);
            });
        } finally {
            db.close();
        }
    };
    return {
        all: () => run("readonly", (s) => s.getAll() as IDBRequest<OutboxOp[]>),
        put: async (op) => void (await run("readwrite", (s) => s.put(op))),
        delete: async (id) => void (await run("readwrite", (s) => s.delete(id))),
        clear: async () => void (await run("readwrite", (s) => s.clear())),
    };
}

let browserStore: OutboxStore | null = null;
/** Stockage du navigateur (IndexedDB), ou null si indisponible (navigation privée stricte, serveur). */
export function browserOutbox(): OutboxStore | null {
    if (typeof window === "undefined" || typeof indexedDB === "undefined") return null;
    browserStore ??= indexedDbStore();
    return browserStore;
}
