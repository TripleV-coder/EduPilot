/**
 * Lecture côté client des listes d'élèves (`GET /api/students`) — N18.
 *
 * La route renvoie `{ data, pagination }` (format paginé du projet). Plusieurs
 * écrans lisaient une clé `students` qui n'existe pas et affichaient une liste
 * vide. Tout consommateur passe désormais par ce module.
 */

/** Extrait les élèves d'une réponse de `/api/students`. */
export function studentListFrom<T>(payload: unknown): T[] {
    if (Array.isArray(payload)) return payload as T[];
    if (payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)) {
        return (payload as { data: T[] }).data;
    }
    return [];
}

/**
 * Charge une liste d'élèves. `query` : paramètres de `/api/students`
 * (ex. `classId=…`, `search=…&limit=10`). Une erreur HTTP est levée, jamais
 * transformée en liste vide.
 */
export async function fetchStudentList<T>(query = ""): Promise<T[]> {
    const response = await fetch(query ? `/api/students?${query}` : "/api/students");
    if (!response.ok) {
        throw new Error(`Chargement des élèves impossible (HTTP ${response.status})`);
    }
    return studentListFrom<T>(await response.json());
}
