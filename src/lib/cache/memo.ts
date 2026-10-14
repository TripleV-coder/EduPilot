/**
 * Mémoïsation de calculs serveur coûteux, propre au processus, avec
 * dédoublonnage des calculs simultanés (« single-flight »).
 *
 * Analyse de capacité du 2026-10-01 (G4) : l'accueil de la direction coûtait
 * 0,36–0,44 s de thread principal et 1,2–1,5 s de CPU à CHAQUE affichage, et
 * 20 demandes simultanées lançaient 20 calculs complets (p50 9,7 s). Avec ce
 * module, un établissement ne calcule son tableau de bord qu'une fois par
 * fenêtre et par processus, quel que soit le nombre de personnes qui l'ouvrent.
 *
 * - La clé doit couvrir TOUS les arguments dont dépend le résultat.
 * - La valeur est partagée entre appelants : elle ne doit pas être modifiée.
 * - Un échec n'est jamais mis en cache ; les appelants en attente le reçoivent.
 * - Désactivée sous Vitest (`NODE_ENV=test`) : les tests modifient les données
 *   entre deux appels identiques et attendent un résultat frais.
 */

interface Entry<R> {
    value: R;
    expiresAt: number;
}

const DEFAULT_MAX_ENTRIES = 2_000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- toute fonction asynchrone
type AsyncFn = (...args: any[]) => Promise<unknown>;

/** Même signature que la fonction calculée (paramètres optionnels compris). */
export type MemoizedAsync<F extends AsyncFn> = F & {
    /** Oublie toutes les valeurs (tests, changement de configuration). */
    clear(): void;
};

export function memoizeAsync<F extends AsyncFn>(
    options: {
        ttlMs: number;
        key: (...args: Parameters<F>) => string;
        maxEntries?: number;
        now?: () => number;
        /** Forcer l'activation (tests du module lui-même). */
        enabled?: boolean;
    },
    compute: F,
): MemoizedAsync<F> {
    type A = Parameters<F>;
    type R = Awaited<ReturnType<F>>;
    const values = new Map<string, Entry<R>>();
    const inflight = new Map<string, Promise<R>>();
    const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    const now = options.now ?? Date.now;

    const memoized = ((...args: A): Promise<R> => {
        const enabled = options.enabled ?? process.env.NODE_ENV !== "test";
        if (!enabled) return compute(...args) as Promise<R>;

        const key = options.key(...args);
        const cached = values.get(key);
        if (cached && cached.expiresAt > now()) return Promise.resolve(cached.value);

        const running = inflight.get(key);
        if (running) return running;

        const promise = (compute(...args) as Promise<R>)
            .then((value) => {
                values.delete(key);
                values.set(key, { value, expiresAt: now() + options.ttlMs });
                // Borne : on évince les plus anciennes insertions.
                for (const oldest of values.keys()) {
                    if (values.size <= maxEntries) break;
                    values.delete(oldest);
                }
                return value;
            })
            .finally(() => {
                inflight.delete(key);
            });
        inflight.set(key, promise);
        return promise;
    }) as unknown as MemoizedAsync<F>;

    memoized.clear = () => {
        values.clear();
        inflight.clear();
    };

    return memoized;
}
