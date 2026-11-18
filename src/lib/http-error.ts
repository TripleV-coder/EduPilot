/**
 * Erreur HTTP lue par les écrans : garde le code de la réponse pour distinguer
 * un refus d'accès (403), une absence (404) ou une session expirée (401) d'une
 * panne. Sans ce code, tout s'affichait « Une erreur est survenue / Réessayer »,
 * et l'utilisateur réessayait en vain un accès qui lui est refusé.
 */
export class FetchError extends Error {
    readonly status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = "FetchError";
        this.status = status;
    }
}

/** Message par défaut quand la réponse n'en donne aucun. */
export function defaultHttpErrorMessage(status: number): string {
    if (status === 401) return "Votre session a expiré : reconnectez-vous.";
    if (status === 403) return "Vous n'avez pas accès à ces informations.";
    if (status === 404) return "Élément introuvable : il a peut-être été supprimé.";
    if (status === 409) return "Action impossible dans l'état actuel. Rechargez la page.";
    if (status === 429) return "Trop de demandes : patientez quelques secondes puis réessayez.";
    if (status === 503) return "Service momentanément indisponible. Réessayez dans un instant.";
    return "Une erreur est survenue lors de la récupération des données.";
}

export function httpStatusOf(error: unknown): number | null {
    if (error instanceof FetchError) return error.status;
    if (error && typeof error === "object" && "status" in error) {
        const status = (error as { status: unknown }).status;
        if (typeof status === "number") return status;
    }
    return null;
}

/** Erreur qu'un nouvel essai ne corrigera pas : session, droits, ressource absente, requête invalide. */
export function isPermanentHttpError(error: unknown): boolean {
    const status = httpStatusOf(error);
    return status !== null && status >= 400 && status < 500 && status !== 408 && status !== 429;
}
