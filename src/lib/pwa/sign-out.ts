"use client";

import { signOut } from "next-auth/react";
import { purgePrivateCaches } from "./cache-policy";
import { unsubscribeThisDevice } from "./push-client";

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

/**
 * Les notifications push de ce compte cessent sur cet appareil (appareil
 * partagé : la personne suivante ne doit pas les recevoir). Pendant que la
 * session existe encore — le serveur exige d'être connecté. Plafonné à 3 s :
 * la déconnexion n'attend jamais un réseau lent.
 */
async function stopPushOnThisDevice(): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        await Promise.race([unsubscribeThisDevice(), new Promise<void>((resolve) => { timer = setTimeout(resolve, 3_000); })]);
    } catch {
        // Service worker indisponible : rien à retirer
    } finally {
        if (timer) clearTimeout(timer);
    }
}

/** Déconnexion : arrêt du push sur cet appareil, purge des caches privés, puis fin de session. */
export async function signOutAndPurge(options?: Parameters<typeof signOut>[0]) {
    await stopPushOnThisDevice();
    await purgeBrowserPrivateCaches();
    return signOut(options);
}
