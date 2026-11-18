/**
 * Signale une erreur affichée dans le navigateur au journal des erreurs
 * (POST /api/monitoring/client-error — remplace Sentry côté client).
 * Envoi « fire-and-forget » (sendBeacon, qui survit à un rechargement de la
 * page), une seule fois par erreur et par page ; ne lève jamais.
 */
const reported = new Set<string>();

export function reportClientError(error: unknown): void {
    try {
        if (typeof window === "undefined") return;
        const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Erreur inconnue");
        const message = `${err.name}: ${err.message}`.slice(0, 500);
        const dedupeKey = `${window.location.pathname}|${message}`;
        if (reported.has(dedupeKey)) return;
        reported.add(dedupeKey);
        const body = JSON.stringify({
            message,
            stack: err.stack?.slice(0, 4000),
            digest: (err as { digest?: string }).digest?.slice(0, 100),
            path: window.location.pathname.slice(0, 300),
        });
        const url = "/api/monitoring/client-error";
        const blob = new Blob([body], { type: "application/json" });
        if (!(typeof navigator.sendBeacon === "function" && navigator.sendBeacon(url, blob))) {
            void fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
        }
    } catch {
        // le signalement ne doit jamais aggraver l'erreur affichée
    }
}
