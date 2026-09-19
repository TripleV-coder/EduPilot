/**
 * Identifiant de requête — traçabilité des journaux (Lot 7).
 *
 * Sans lui, deux erreurs signalées à la même minute par deux utilisateurs sont
 * indiscernables dans le journal : l'exploitant ne peut relier ce que la
 * personne a vu à l'écran à ce que le serveur a écrit. Chaque requête API en
 * porte un, repris de l'en-tête `X-Request-Id` de l'appelant quand il en
 * fournit un sain (le client `lib/api/client.ts` en envoie déjà un), sinon
 * généré. Il est renvoyé dans la réponse et ajouté à chaque ligne de journal.
 *
 * Portée par `AsyncLocalStorage` : aucune route n'a à le transporter à la
 * main. Ce module n'est chargé que dans le runtime Node (routes, tâches de
 * fond) ; le middleware Edge ne l'importe pas.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { setRequestIdProvider } from "@/lib/utils/logger";

export const REQUEST_ID_HEADER = "X-Request-Id";

/** Identifiant accepté tel quel : ni espace, ni saut de ligne, ni guillemet. */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

const storage = new AsyncLocalStorage<string>();

/** Identifiant de la requête en cours, s'il y en a une. */
export function getRequestId(): string | undefined {
    return storage.getStore();
}

/** Exécute `fn` en attachant `requestId` à tout ce qui s'y passe. */
export function runWithRequestId<T>(requestId: string, fn: () => T): T {
    return storage.run(requestId, fn);
}

/**
 * Identifiant de la requête entrante.
 *
 * Celui de l'appelant n'est repris que s'il est sain : il finit dans un
 * journal JSON, un identifiant forgé contenant guillemets et sauts de ligne y
 * injecterait de fausses lignes.
 */
export function requestIdFromHeaders(headers?: Headers | null): string {
    const provided = headers?.get?.(REQUEST_ID_HEADER);
    if (provided && SAFE_REQUEST_ID.test(provided)) return provided;
    return randomUUID();
}

// Le journal porte l'identifiant dès que ce module est chargé, c'est-à-dire
// dès la première route : aucune ligne n'a à le passer à la main.
setRequestIdProvider(getRequestId);
