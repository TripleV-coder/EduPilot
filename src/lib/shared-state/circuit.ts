/**
 * Coupe-circuit du magasin d'état partagé (PostgreSQL) — repris du
 * coupe-circuit Redis de l'audit H6, mêmes garanties :
 *   - chaque opération est bornée à `timeoutMs` (course contre une minuterie) ;
 *   - au premier échec, le circuit s'ouvre `openMs` : les appels suivants
 *     passent directement au repli mémoire, sans attendre la base ;
 *   - à l'expiration, un seul essai décide de la réouverture ou de la reprise ;
 *   - la dégradation est journalisée UNE fois par épisode, le rétablissement aussi.
 *
 * Une requête n'attend donc jamais un magasin en panne : au pire `timeoutMs`
 * une fois, puis le repli local pendant `openMs`.
 */
export interface StoreCircuitOptions {
    timeoutMs?: number;
    openMs?: number;
    now?: () => number;
    onDegraded?: (error: unknown) => void;
    onRecovered?: () => void;
}

/** Délai par défaut : couvre l'ouverture d'une connexion TLS à froid (sans serveur). */
export const STORE_TIMEOUT_MS = 1_000;
export const STORE_OPEN_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Magasin partagé : pas de réponse en ${ms} ms`)), ms);
    });
    return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export class StoreCircuit {
    private openUntil = 0;
    private degraded = false;

    constructor(private readonly options: StoreCircuitOptions = {}) {}

    private now(): number {
        return (this.options.now ?? Date.now)();
    }

    isOpen(): boolean {
        return this.now() < this.openUntil;
    }

    /** Exécute `operation`, ou `fallback` si le circuit est ouvert ou si l'opération échoue. */
    async run<T>(operation: () => Promise<T>, fallback: () => T | Promise<T>): Promise<T> {
        if (this.isOpen()) return fallback();

        try {
            const value = await withTimeout(operation(), this.options.timeoutMs ?? STORE_TIMEOUT_MS);
            if (this.degraded) {
                this.degraded = false;
                this.options.onRecovered?.();
            }
            return value;
        } catch (error) {
            this.openUntil = this.now() + (this.options.openMs ?? STORE_OPEN_MS);
            if (!this.degraded) {
                this.degraded = true;
                this.options.onDegraded?.(error);
            }
            return fallback();
        }
    }
}
