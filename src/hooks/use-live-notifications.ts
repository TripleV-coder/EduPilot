"use client";

import { useEffect, useRef } from "react";

/**
 * Notifications en temps réel (flux SSE `/api/notifications/stream`).
 *
 * UNE seule connexion par onglet, partagée par tous les composants abonnés
 * (barre du haut, messagerie, page des notifications), ouverte tant qu'il en
 * reste au moins un. Le navigateur se reconnecte seul après une coupure
 * réseau ou la fin de connexion (30 min) ; si le serveur refuse (session
 * expirée, base indisponible), nouvel essai après 30 s, puis 1, 2, 5 min.
 * Après une REconnexion, les abonnés reçoivent `reconnected` : ils relisent
 * leurs données pour rattraper ce qui serait arrivé pendant la coupure (rien
 * à la première connexion : la page vient de charger ses données).
 */
export interface LiveNotification {
    id: string;
    type: string;
    title: string;
    message: string;
    link: string | null;
    createdAt: string;
}

export type LiveEvent = { kind: "reconnected" } | { kind: "notifications"; items: LiveNotification[] };
type Listener = (event: LiveEvent) => void;

const STREAM_URL = "/api/notifications/stream";
const RETRY_DELAYS_MS = [30_000, 60_000, 120_000, 300_000];

const listeners = new Set<Listener>();
let source: EventSource | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let failures = 0;

function emit(event: LiveEvent) {
    for (const listener of [...listeners]) {
        try {
            listener(event);
        } catch {
            // un abonné défaillant n'empêche pas les autres
        }
    }
}

function open() {
    if (source || typeof EventSource === "undefined") return;
    const es = new EventSource(STREAM_URL);
    source = es;
    // Nouvel essai après un refus, ou reconnexion automatique du navigateur
    let resumed = failures > 0;
    es.addEventListener("connected", () => {
        failures = 0;
        if (resumed) emit({ kind: "reconnected" });
        resumed = true;
    });
    es.addEventListener("notifications", (event) => {
        try {
            const items = JSON.parse((event as MessageEvent<string>).data) as LiveNotification[];
            if (Array.isArray(items) && items.length > 0) emit({ kind: "notifications", items });
        } catch {
            // charge illisible : ignorée
        }
    });
    es.onerror = () => {
        // CONNECTING : le navigateur réessaie seul. CLOSED : refus du serveur.
        if (es.readyState !== EventSource.CLOSED) return;
        es.close();
        if (source === es) source = null;
        if (listeners.size === 0 || retryTimer) return;
        const delay = RETRY_DELAYS_MS[Math.min(failures, RETRY_DELAYS_MS.length - 1)];
        failures += 1;
        retryTimer = setTimeout(() => {
            retryTimer = null;
            if (listeners.size > 0) open();
        }, delay);
    };
}

function close() {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    source?.close();
    source = null;
    failures = 0;
}

/** Abonnement direct (hors React) ; renvoie la fonction de désabonnement. */
export function subscribeLiveNotifications(listener: Listener): () => void {
    listeners.add(listener);
    open();
    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) close();
    };
}

/** Appelle `onEvent` à chaque notification reçue et après chaque reconnexion. */
export function useLiveNotifications(onEvent: Listener, enabled = true): void {
    const latest = useRef(onEvent);
    useEffect(() => {
        latest.current = onEvent;
    });
    useEffect(() => {
        if (!enabled) return;
        return subscribeLiveNotifications((event) => latest.current(event));
    }, [enabled]);
}
