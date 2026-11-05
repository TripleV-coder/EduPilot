import { FetchError, defaultHttpErrorMessage } from "@/lib/http-error";

export const fetcher = async (url: string) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);

    // Jamais de lecture du cache HTTP du navigateur (audit MS-03) : les réponses
    // privées envoyées avant le passage à `no-store` (`private, max-age`) peuvent
    // y rester quelques minutes et appartenir à un autre compte ou à une autre école.
    const res = await fetch(url, {
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
    }).finally(() => clearTimeout(timeout));
    if (!res.ok) {
        let message = defaultHttpErrorMessage(res.status);
        try {
            const errorData = (await res.json()) as { error?: unknown };
            // Message du serveur quand il en donne un lisible (les routes répondent en français)
            if (typeof errorData.error === "string" && errorData.error.trim()) message = errorData.error;
        } catch {
            // Réponse non JSON : le message par défaut du code HTTP reste.
        }
        // Le code HTTP voyage avec l'erreur : refus (403), absence (404) et session
        // expirée (401) ne s'affichent plus comme une panne à « réessayer ».
        throw new FetchError(res.status, message);
    }
    return res.json();
};
