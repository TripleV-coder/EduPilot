"use client";

import { useOfflineOutbox } from "@/hooks/use-offline-outbox";

/** Envoi automatique de la file hors ligne : monté une seule fois, dans la coque. */
export function OfflineOutboxSync() {
    useOfflineOutbox({ autoFlush: true });
    return null;
}

/**
 * État de la file hors ligne pour l'utilisateur (OFF-01) : saisies gardées
 * sur l'appareil, refus du serveur à traiter. Rien n'est affiché sans saisie.
 */
export function OfflineOutboxNotice({ kind }: { kind?: "attendance" | "grades" }) {
    const { ops, flush, discard } = useOfflineOutbox();
    const mine = kind ? ops.filter((op) => op.kind === kind) : ops;
    if (mine.length === 0) return null;
    const queued = mine.filter((op) => op.status === "queued");
    const rejected = mine.filter((op) => op.status === "rejected");
    return (
        <div role="status" className="mb-4 space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
            {queued.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                    <span className="flex-1">
                        {queued.length === 1 ? "1 saisie gardée sur cet appareil" : `${queued.length} saisies gardées sur cet appareil`} :{" "}
                        {queued.map((op) => op.label).join(" · ")}.{" "}
                        {queued.length === 1 ? "Elle sera envoyée" : "Elles seront envoyées"} dès le retour du réseau.
                    </span>
                    <button type="button" className="rounded-md border border-amber-400 px-2 py-1 font-medium" onClick={() => void flush()}>
                        Réessayer maintenant
                    </button>
                </div>
            ) : null}
            {rejected.map((op) => (
                <div key={op.id} className="flex flex-wrap items-center gap-2" role="alert">
                    <span className="flex-1">
                        <strong>{op.label}</strong> n&apos;a pas été accepté : {op.lastError}. Ressaisissez-le après correction.
                    </span>
                    <button type="button" className="rounded-md border border-amber-400 px-2 py-1 font-medium" onClick={() => void discard(op.id)}>
                        Retirer
                    </button>
                </div>
            ))}
        </div>
    );
}
