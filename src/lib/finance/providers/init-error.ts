import { CircuitOpenError } from "@/lib/resilience/errors";

/**
 * Échec de création d'une transaction chez un fournisseur de paiement
 * (lot 3b). L'absence d'identifiant ne prouve pas l'absence de transaction :
 * - REFUSED : le code prouve que la demande de création n'a JAMAIS été
 *   envoyée (validation locale, jeton refusé avant l'envoi, circuit ouvert)
 *   — aucune transaction ne peut exister ;
 * - UNKNOWN : la demande a pu atteindre le fournisseur — délai dépassé,
 *   coupure, réponse illisible ou incomplète, et TOUTE réponse HTTP d'erreur,
 *   4xx compris : aucune garantie documentée dans le projet n'établit qu'un
 *   code d'erreur prouve l'absence de transaction (à confirmer auprès de
 *   chaque fournisseur réel avant d'en faire un refus définitif).
 *   `providerTransactionId`, quand il est connu (généré avant l'envoi, ou
 *   référence marchande servant à la vérification), permet à la
 *   réconciliation de l'interroger plus tard.
 */
export type InitOutcome = "REFUSED" | "UNKNOWN";

export class ProviderInitError extends Error {
    constructor(
        message: string,
        readonly outcome: InitOutcome,
        readonly providerTransactionId?: string,
        options?: { cause?: unknown },
    ) {
        super(message, options);
        this.name = "ProviderInitError";
    }
}

/**
 * Réponse HTTP d'erreur du fournisseur à une demande de création : la demande
 * l'a atteint, le résultat reste inconnu quel que soit le code (voir ci-dessus).
 */
export function outcomeForHttpStatus(_status: number): InitOutcome {
    return "UNKNOWN";
}

/** Erreur levée à l'envoi : circuit ouvert = jamais envoyée ; sinon (délai, réseau) = inconnu. */
export function outcomeForSendError(error: unknown): InitOutcome {
    return error instanceof CircuitOpenError ? "REFUSED" : "UNKNOWN";
}

/** Note posée sur un essai dont la création reste incertaine (repérée à la reprise et en réconciliation). */
export const INIT_UNCERTAIN_NOTE =
    "Résultat de l'initialisation inconnu chez le fournisseur : reste en attente, montant réservé, à vérifier.";
