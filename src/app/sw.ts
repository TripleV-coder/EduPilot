import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";
import { buildRuntimeCaching, purgePrivateCaches } from "@/lib/pwa/cache-policy";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: WorkerGlobalScope;

/**
 * Préchargement restreint à la coquille.
 *
 * Le manifeste produit par le build contient **tout** le JavaScript de
 * l'application — 247 fragments, 8,5 Mo. Les précharger revient à télécharger
 * l'application entière, y compris les écrans que la personne n'ouvrira jamais,
 * pendant qu'elle essaie de s'en servir. Sur la connexion lente d'un
 * établissement, cette installation en arrière-plan prend la bande passante de
 * la navigation en cours.
 *
 * On ne précharge donc que ce qui doit exister avant toute visite : la page
 * hors-ligne, le manifeste et les icônes, plus les feuilles de style (petites,
 * et nécessaires pour que la page hors-ligne s'affiche correctement). Le
 * JavaScript est mis en cache **à l'usage** par `defaultCache`
 * (`/_next/static/*.js` → CacheFirst) : une page déjà ouverte reste donc
 * disponible hors ligne, sans rien télécharger d'inutile à l'avance.
 */
function shellEntries(manifest: (PrecacheEntry | string)[] | undefined) {
  if (!manifest) return [];
  const urlOf = (entry: PrecacheEntry | string) => (typeof entry === "string" ? entry : entry.url);
  return manifest.filter((entry) => {
    const url = urlOf(entry);
    if (!url.startsWith("/_next/")) return true; // /offline, /manifest.json, icônes
    return url.endsWith(".css");
  });
}

const serwist = new Serwist({
  precacheEntries: shellEntries(self.__SW_MANIFEST),
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // Ressources statiques seulement : API et pages toujours par le réseau (audit MS-03)
  runtimeCaching: buildRuntimeCaching(defaultCache),
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

// Les versions précédentes mettaient en cache API et pages : ces entrées sont
// supprimées dès l'activation de ce service worker (skipWaiting + clientsClaim).
const worker = self as unknown as {
  caches: CacheStorage;
  addEventListener(type: "activate", listener: (event: Event & { waitUntil(promise: Promise<unknown>): void }) => void): void;
};
worker.addEventListener("activate", (event) => {
  event.waitUntil(purgePrivateCaches(worker.caches));
});
