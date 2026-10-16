"use client";

import { signOut } from "next-auth/react";
import { purgePrivateCaches } from "./cache-policy";

/**
 * Efface du navigateur les réponses privées que d'anciennes versions du
 * service worker ont pu conserver (audit MS-03). Sans effet, et sans erreur,
 * là où le Cache API n'existe pas.
 */
export async function purgeBrowserPrivateCaches(): Promise<void> {
    if (typeof window === "undefined" || !("caches" in window)) return;
    try {
        await purgePrivateCaches(window.caches);
    } catch {
        // Stockage indisponible (navigation privée, quota) : rien à purger
    }
}

/** Déconnexion : purge des caches privés du navigateur, puis fin de session. */
export async function signOutAndPurge(options?: Parameters<typeof signOut>[0]) {
    await purgeBrowserPrivateCaches();
    return signOut(options);
}
