/**
 * Politique de cache du service worker (audit MS-03, 2026-10-16).
 *
 * Le `defaultCache` de Serwist met en cache, par URL seule, les réponses
 * `GET /api/*`, les pages et les flux RSC (24 h, servis si le réseau échoue ou
 * tarde plus de 10 s), ainsi que les images d'URL quelconque (pièces jointes
 * `/api/uploads/...`). Sur un appareil partagé, ou après un changement d'école,
 * ces réponses pouvaient être resservies à un autre compte. Le Cache API ignore
 * `Cache-Control` : l'exclusion doit être faite ici, explicitement.
 *
 * Règle : seules les ressources statiques publiques sont mises en cache.
 * API, pages, RSC, images optimisées et requêtes vers d'autres origines
 * passent toujours par le réseau. Aucune consultation hors ligne de données
 * scolaires (décision Q-PERF-02 en attente).
 */
import { NetworkOnly, type RuntimeCaching } from "serwist";

/**
 * Caches de `defaultCache` conservés : ressources statiques de l'application,
 * sans donnée personnelle. (Polices Google exclues : les autres origines ne
 * sont jamais mises en cache, et `next/font` sert les polices localement.)
 */
export const STATIC_CACHE_NAMES: ReadonlySet<string> = new Set([
    "static-font-assets",
    "static-image-assets",
    "next-static-js-assets",
    "static-audio-assets",
    "static-video-assets",
    "static-js-assets",
    "static-style-assets",
]);

/**
 * Caches créés par les versions précédentes du service worker et susceptibles
 * de contenir des données privées : supprimés à l'activation et à la déconnexion.
 */
export const PRIVATE_CACHE_NAMES: readonly string[] = [
    "apis",
    "pages",
    "pages-rsc",
    "pages-rsc-prefetch",
    "others",
    "next-data",
    "static-data-assets",
    "cross-origin",
    "next-image",
];

/** Chemins jamais conservés, même dans un cache statique (pièces jointes, images optimisées). */
export function isPrivatePath(pathname: string): boolean {
    return pathname === "/api" || pathname.startsWith("/api/") || pathname.startsWith("/_next/image");
}

function cacheNameOf(entry: RuntimeCaching): string | undefined {
    const handler = entry.handler as { cacheName?: unknown };
    return typeof handler.cacheName === "string" ? handler.cacheName : undefined;
}

/**
 * Règles du service worker : d'abord le réseau seul pour tout ce qui peut
 * porter des données privées, puis les seuls caches statiques de `defaultCache`.
 * L'ordre compte : Serwist applique la première règle qui correspond.
 */
export function buildRuntimeCaching(defaultCache: readonly RuntimeCaching[]): RuntimeCaching[] {
    const networkOnly = new NetworkOnly();
    return [
        // API, toutes méthodes : jamais en cache
        ...(["GET", "POST", "PUT", "PATCH", "DELETE"] as const).map((method) => ({
            matcher: ({ sameOrigin, url }: { sameOrigin: boolean; url: URL }) => sameOrigin && isPrivatePath(url.pathname),
            method,
            handler: networkOnly,
        })),
        // Pages et flux RSC : réseau seul ; en cas d'échec, page hors ligne (fallbacks)
        {
            matcher: ({ request, sameOrigin }: { request: Request; sameOrigin: boolean }) =>
                sameOrigin && (request.mode === "navigate" || request.headers.get("RSC") === "1"),
            handler: networkOnly,
        },
        // Autres origines : réseau seul (aucune donnée tierce conservée)
        { matcher: ({ sameOrigin }: { sameOrigin: boolean }) => !sameOrigin, handler: networkOnly },
        ...defaultCache.filter((entry) => {
            const name = cacheNameOf(entry);
            return name !== undefined && STATIC_CACHE_NAMES.has(name);
        }),
    ];
}

/** Sous-ensemble de `CacheStorage` utilisé (testable sans navigateur). */
export interface CacheStorageLike {
    keys(): Promise<string[]>;
    delete(name: string): Promise<boolean>;
    open(name: string): Promise<{ keys(): Promise<readonly Request[]>; delete(request: Request): Promise<boolean> }>;
}

/**
 * Supprime les caches privés hérités, puis, dans les caches restants, toute
 * entrée dont le chemin est privé. Renvoie le nombre de caches et d'entrées supprimés.
 */
export async function purgePrivateCaches(storage: CacheStorageLike): Promise<{ caches: number; entries: number }> {
    let caches = 0;
    let entries = 0;
    const names = await storage.keys();
    for (const name of names) {
        if (PRIVATE_CACHE_NAMES.includes(name)) {
            if (await storage.delete(name)) caches++;
            continue;
        }
        const cache = await storage.open(name);
        for (const request of await cache.keys()) {
            let pathname: string;
            try {
                pathname = new URL(request.url).pathname;
            } catch {
                continue;
            }
            if (isPrivatePath(pathname) && (await cache.delete(request))) entries++;
        }
    }
    return { caches, entries };
}
