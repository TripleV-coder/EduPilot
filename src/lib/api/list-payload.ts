/**
 * Lecture côté client d'une liste renvoyée par l'API — N25.
 *
 * Les listes paginées du projet renvoient `{ data, pagination }`. Plusieurs
 * écrans lisaient une autre clé (`classes`…) ou traitaient la réponse comme un
 * tableau : liste vide, voire plantage (`.map` sur un objet).
 */
export function listFrom<T>(payload: unknown): T[] {
    if (Array.isArray(payload)) return payload as T[];
    if (payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)) {
        return (payload as { data: T[] }).data;
    }
    return [];
}
