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

// ─── Notifications push (lib/push) ──────────────────────────────────────────
// Le serveur envoie { title, body, url, tag } chiffré ; on l'affiche, et le
// clic ouvre (ou ramène au premier plan) la page indiquée — un chemin interne
// seulement, jamais une adresse extérieure.
const NOTIFICATIONS_PATH = "/dashboard/notifications";

interface PushPayload {
  title?: unknown;
  body?: unknown;
  url?: unknown;
  tag?: unknown;
}

type PushEventLike = Event & { data: { json(): unknown } | null; waitUntil(promise: Promise<unknown>): void };
type NotificationClickEventLike = Event & {
  notification: { data?: { url?: unknown }; close(): void };
  waitUntil(promise: Promise<unknown>): void;
};
type WindowClientLike = { url: string; focus(): Promise<unknown>; navigate?(url: string): Promise<unknown> };

const pushWorker = self as unknown as {
  location: { origin: string };
  registration: { showNotification(title: string, options: Record<string, unknown>): Promise<void> };
  clients: {
    matchAll(options: { type: "window"; includeUncontrolled: boolean }): Promise<WindowClientLike[]>;
    openWindow(url: string): Promise<unknown>;
  };
  addEventListener(type: "push", listener: (event: PushEventLike) => void): void;
  addEventListener(type: "notificationclick", listener: (event: NotificationClickEventLike) => void): void;
};

function internalPath(value: unknown): string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : NOTIFICATIONS_PATH;
}

pushWorker.addEventListener("push", (event) => {
  let payload: PushPayload = {};
  try {
    payload = (event.data?.json() ?? {}) as PushPayload;
  } catch {
    payload = {};
  }
  const title = typeof payload.title === "string" && payload.title ? payload.title : "EduPilot";
  const tag = typeof payload.tag === "string" && payload.tag ? payload.tag : undefined;
  event.waitUntil(
    pushWorker.registration.showNotification(title, {
      body: typeof payload.body === "string" ? payload.body : "",
      icon: "/icons/notification-192.png",
      badge: "/icons/badge-96.png",
      lang: "fr",
      ...(tag ? { tag, renotify: true } : {}),
      data: { url: internalPath(payload.url) },
    }),
  );
});

pushWorker.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(internalPath(event.notification.data?.url), pushWorker.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await pushWorker.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === pushWorker.location.origin);
      if (open) {
        await open.focus();
        if (open.navigate) await open.navigate(target);
        return;
      }
      await pushWorker.clients.openWindow(target);
    })(),
  );
});
