import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import prisma from "@/lib/prisma";
import { canAccessSchool, getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createAuditLog } from "@/lib/security/audit-log";

/**
 * Établissement d'une vue ou d'une opération financière (S6, 2026-10-18).
 *
 * Les données financières appartiennent à une école. Le super-administrateur
 * n'a pas d'école propre : sans sélection, plusieurs routes lui renvoyaient
 * silencieusement les paiements, échéanciers ou écritures de TOUS les
 * établissements mélangés. Désormais :
 * - l'école doit être choisie explicitement (école active de la session, ou
 *   identifiant fourni quand aucune n'est active) — sinon 400 ;
 * - l'identifiant fourni est vérifié en base (école inexistante : 404) ;
 * - un identifiant différent de l'école active est refusé (403) : pas de
 *   substitution d'école dans une requête ;
 * - chaque accès du super-administrateur, accordé ou refusé, est journalisé
 *   (utilisateur, école, opération, résultat ; aucun montant ni secret).
 * Les autres rôles gardent leur périmètre habituel (école active, ou école
 * accessible demandée explicitement).
 *
 * Les vues réellement globales (console racine) ne passent pas par ici : elles
 * sont réservées au compte racine et identifiées comme telles.
 */

export const FINANCE_SCOPE_AUDIT_ACTION = "FINANCE_SCOPE_ACCESS";

export type FinanceSchoolScope =
    | { ok: true; schoolId: string }
    | { ok: false; response: NextResponse };

const denial = (status: number, code: string, error: string) => NextResponse.json({ error, code }, { status });

/** Identifiant raisonnable (cuid/uuid) : au-delà, inutile d'interroger la base. */
const isPlausibleId = (value: string) => value.length <= 64 && /^[A-Za-z0-9_-]+$/.test(value);

async function auditSuperAdmin(
    session: Session,
    operation: string,
    outcome: "GRANTED" | "DENIED",
    schoolId: string | null,
    reason?: string,
) {
    await createAuditLog({
        userId: session.user.id,
        action: FINANCE_SCOPE_AUDIT_ACTION,
        entity: "FINANCE",
        // Refus : l'école peut ne pas exister (clé étrangère), seul le motif est gardé
        schoolId: outcome === "GRANTED" ? schoolId : null,
        newValues: { operation, outcome, ...(reason ? { reason } : {}) },
        severity: outcome === "GRANTED" ? "INFO" : "WARNING",
    });
}

/**
 * École sur laquelle porte l'opération financière `operation` (ex. « payments:list »).
 * `requestedSchoolId` : identifiant fourni par le client (requête ou corps), s'il y en a un.
 */
export async function resolveFinanceSchool(
    session: Session,
    requestedSchoolId: string | null | undefined,
    operation: string,
): Promise<FinanceSchoolScope> {
    const requested = typeof requestedSchoolId === "string" && requestedSchoolId.trim() ? requestedSchoolId.trim() : null;
    const activeSchoolId = getActiveSchoolId(session) ?? null;

    if (session.user.role !== "SUPER_ADMIN") {
        const schoolId = requested ?? activeSchoolId;
        if (!schoolId) return { ok: false, response: denial(403, "NO_SCHOOL", "Aucun établissement associé à ce compte") };
        if (!canAccessSchool(session, schoolId)) {
            return { ok: false, response: denial(403, "SCHOOL_FORBIDDEN", "Accès refusé : établissement hors périmètre autorisé.") };
        }
        return { ok: true, schoolId };
    }

    if (requested && activeSchoolId && requested !== activeSchoolId) {
        await auditSuperAdmin(session, operation, "DENIED", null, "SCHOOL_MISMATCH");
        return {
            ok: false,
            response: denial(403, "SCHOOL_MISMATCH", "Cet établissement n'est pas celui sélectionné. Changez d'établissement avant de continuer."),
        };
    }
    const schoolId = activeSchoolId ?? requested;
    if (!schoolId) {
        return {
            ok: false,
            response: denial(400, "SCHOOL_REQUIRED", "Sélectionnez un établissement : les données financières sont propres à chaque école."),
        };
    }
    const school = isPlausibleId(schoolId)
        ? await prisma.school.findUnique({ where: { id: schoolId }, select: { id: true } })
        : null;
    if (!school) {
        await auditSuperAdmin(session, operation, "DENIED", null, "SCHOOL_NOT_FOUND");
        return { ok: false, response: denial(404, "SCHOOL_NOT_FOUND", "Établissement introuvable") };
    }
    await auditSuperAdmin(session, operation, "GRANTED", school.id);
    return { ok: true, schoolId: school.id };
}

/**
 * Élément financier existant (paiement, frais, échéancier) d'une école donnée :
 * le super-administrateur ne peut y toucher que dans l'école sélectionnée.
 * Renvoie la réponse de refus, ou null. Les autres rôles sont contrôlés par
 * les routes elles-mêmes (canAccessSchool), inchangé.
 */
export async function superAdminTargetOutOfScope(
    session: Session,
    targetSchoolId: string,
    operation: string,
): Promise<NextResponse | null> {
    if (session.user.role !== "SUPER_ADMIN") return null;
    const scope = await resolveFinanceSchool(session, null, operation);
    if (!scope.ok) return scope.response;
    if (scope.schoolId !== targetSchoolId) {
        await auditSuperAdmin(session, operation, "DENIED", null, "TARGET_OTHER_SCHOOL");
        return denial(403, "SCHOOL_MISMATCH", "Cet élément appartient à un autre établissement que celui sélectionné.");
    }
    return null;
}
