"use client";

import { SerwistProvider } from "@serwist/turbopack/react";

/**
 * Enregistre le service worker Serwist en production uniquement.
 * En développement, l'enregistrement est désactivé pour éviter les caches parasites.
 */
export function ServiceWorkerRegister() {
  return (
    <SerwistProvider
      swUrl="/serwist/sw.js"
      register
      cacheOnNavigation
      reloadOnOnline
      disable={process.env.NODE_ENV !== "production"}
    />
  );
}