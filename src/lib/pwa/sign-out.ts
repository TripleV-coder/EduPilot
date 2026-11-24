"use client";

import { getSession, signOut } from "next-auth/react";
import { purgePrivateCaches } from "./cache-policy";
import { unsubscribeThisDevice } from "./push-client";
import { browserOutbox, flushOutbox, pendingFor } from "@/lib/offline/outbox";
import { sendOutboxOp } from "@/lib/offline/senders";

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

/**
 * OFF-01 : saisies gardées hors ligne. On tente de les envoyer (session encore
 * valide) ; s'il en reste, la personne confirme qu'elles seront effacées de
 * l'appareil (appareil partagé : rien ne doit rester derrière elle). Renvoie
 * false si elle préfère rester connectée.
 */
async function settleOfflineOutbox(knownUserId: string | undefined): Promise<boolean> {
    const store = browserOutbox();
    if (!store) return true;
    try {
        if ((await store.all()).length === 0) return true;
        const userId = knownUserId ?? (await getSession().catch(() => null))?.user?.id;
        if (userId && navigator.onLine) await flushOutbox(store, userId, sendOutboxOp);
        const left = userId ? await pendingFor(store, userId) : await store.all();
        if (left.length > 0) {
            const ok = window.confirm(
                `${left.length === 1 ? "1 saisie faite" : `${left.length} saisies faites`} hors connexion ${left.length === 1 ? "n'a" : "n'ont"} pas encore été ${left.length === 1 ? "envoyée" : "envoyées"} (${left.map((op) => op.label).join(", ")}).\n\nSi vous vous déconnectez, ${left.length === 1 ? "elle sera effacée" : "elles seront effacées"} de cet appareil. Se déconnecter quand même ?`,
            );
            if (!ok) return false;
        }
        await store.clear();
    } catch {
        // Stockage indisponible : rien à envoyer ni à effacer
    }
    return true;
}

/** Déconnexion : file hors ligne réglée, arrêt du push sur cet appareil, purge des caches privés, puis fin de session. */
export async function signOutAndPurge(options?: Parameters<typeof signOut>[0], userId?: string) {
    if (!(await settleOfflineOutbox(userId))) return;
    await stopPushOnThisDevice();
    await purgeBrowserPrivateCaches();
    return signOut(options);
}
