import type { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { resolveSchoolScope, superAdminTargetOutOfSchoolScope, type SchoolScope } from "@/lib/api/school-scope";

/**
 * Établissement d'une vue ou d'une opération financière (S6, 2026-10-18).
 *
 * Les données financières appartiennent à une école. Le super-administrateur
 * n'a pas d'école propre : sans sélection, plusieurs routes lui renvoyaient
 * silencieusement les paiements, échéanciers ou écritures de TOUS les
 * établissements mélangés. Règles communes (sélection explicite, école
 * vérifiée en base, refus de substitution, audit) : `@/lib/api/school-scope`.
 * Ici, journal propre aux finances (aucun montant ni secret).
 *
 * Les vues réellement globales (console racine) ne passent pas par ici : elles
 * sont réservées au compte racine et identifiées comme telles.
 */

export const FINANCE_SCOPE_AUDIT_ACTION = "FINANCE_SCOPE_ACCESS";

export type FinanceSchoolScope = SchoolScope;

const FINANCE_AUDIT = { action: FINANCE_SCOPE_AUDIT_ACTION, entity: "FINANCE" };
const REQUIRED = "Sélectionnez un établissement : les données financières sont propres à chaque école.";

/**
 * École sur laquelle porte l'opération financière `operation` (ex. « payments:list »).
 * `requestedSchoolId` : identifiant fourni par le client (requête ou corps), s'il y en a un.
 */
export function resolveFinanceSchool(
    session: Session,
    requestedSchoolId: string | null | undefined,
    operation: string,
): Promise<FinanceSchoolScope> {
    return resolveSchoolScope(session, requestedSchoolId, operation, FINANCE_AUDIT, REQUIRED);
}

/**
 * Élément financier existant (paiement, frais, échéancier) d'une école donnée :
 * le super-administrateur ne peut y toucher que dans l'école sélectionnée.
 * Renvoie la réponse de refus, ou null. Les autres rôles sont contrôlés par
 * les routes elles-mêmes (canAccessSchool), inchangé.
 */
export function superAdminTargetOutOfScope(
    session: Session,
    targetSchoolId: string,
    operation: string,
): Promise<NextResponse | null> {
    return superAdminTargetOutOfSchoolScope(session, targetSchoolId, operation, FINANCE_AUDIT, REQUIRED);
}
