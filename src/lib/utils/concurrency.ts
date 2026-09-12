/**
 * Applique `worker` à chaque élément avec au plus `limit` tâches simultanées.
 * Un échec n'interrompt pas les autres éléments ; les échecs sont renvoyés.
 */
export async function forEachWithConcurrency<T>(
    items: readonly T[],
    limit: number,
    worker: (item: T) => Promise<void>,
): Promise<Array<{ item: T; error: unknown }>> {
    const failures: Array<{ item: T; error: unknown }> = [];
    let next = 0;

    const runners = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
        while (next < items.length) {
            const item = items[next++];
            try {
                await worker(item);
            } catch (error) {
                failures.push({ item, error });
            }
        }
    });

    await Promise.all(runners);
    return failures;
}
