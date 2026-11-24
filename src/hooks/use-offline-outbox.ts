"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
    OUTBOX_CHANGED_EVENT,
    browserOutbox,
    discard as discardOp,
    enqueue as enqueueOp,
    flushOutbox,
    pendingFor,
    type OutboxKind,
    type OutboxOp,
} from "@/lib/offline/outbox";
import { sendOutboxOp } from "@/lib/offline/senders";

const RETRY_MS = 30_000;

/**
 * File hors ligne de l'utilisateur connecté (OFF-01) : opérations en attente
 * ou refusées, envoi automatique au retour du réseau et toutes les 30 s tant
 * qu'il en reste. `autoFlush` n'est activé qu'à un seul endroit (coque).
 */
export function useOfflineOutbox({ autoFlush = false }: { autoFlush?: boolean } = {}) {
    const { data: session } = useSession();
    const userId = session?.user?.id ?? null;
    const schoolId = (session?.user as { schoolId?: string | null } | undefined)?.schoolId ?? null;
    const [ops, setOps] = useState<OutboxOp[]>([]);
    const flushing = useRef(false);

    const refresh = useCallback(async () => {
        const store = browserOutbox();
        if (!store || !userId) return setOps([]);
        try {
            setOps(await pendingFor(store, userId));
        } catch {
            setOps([]);
        }
    }, [userId]);

    const flush = useCallback(async () => {
        const store = browserOutbox();
        if (!store || !userId || flushing.current) return;
        if (typeof navigator !== "undefined" && !navigator.onLine) return;
        flushing.current = true;
        try {
            await flushOutbox(store, userId, sendOutboxOp);
        } finally {
            flushing.current = false;
            await refresh();
        }
    }, [userId, refresh]);

    const enqueue = useCallback(
        async (kind: OutboxKind, label: string, payload: unknown, id: string = crypto.randomUUID()) => {
            const store = browserOutbox();
            if (!store || !userId) throw new Error("Enregistrement sur l'appareil impossible (stockage indisponible).");
            await enqueueOp(store, { id, userId, schoolId, kind, label, payload });
            await refresh();
        },
        [userId, schoolId, refresh],
    );

    const discard = useCallback(async (id: string) => {
        const store = browserOutbox();
        if (store) await discardOp(store, id);
        await refresh();
    }, [refresh]);

    useEffect(() => {
        void refresh();
        const onChange = () => void refresh();
        window.addEventListener(OUTBOX_CHANGED_EVENT, onChange);
        return () => window.removeEventListener(OUTBOX_CHANGED_EVENT, onChange);
    }, [refresh]);

    const queuedCount = ops.filter((op) => op.status === "queued").length;
    useEffect(() => {
        if (!autoFlush) return;
        const onOnline = () => void flush();
        window.addEventListener("online", onOnline);
        void flush();
        const timer = queuedCount > 0 ? setInterval(() => void flush(), RETRY_MS) : undefined;
        return () => {
            window.removeEventListener("online", onOnline);
            if (timer) clearInterval(timer);
        };
    }, [autoFlush, flush, queuedCount]);

    return { ops, queuedCount, rejected: ops.filter((op) => op.status === "rejected"), enqueue, flush, discard };
}
