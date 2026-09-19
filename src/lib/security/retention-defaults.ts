/**
 * Durées de conservation par défaut (Lot 6) — décision du propriétaire du
 * 2026-09-14, en MOIS, dans l'ordre d'application de la purge.
 *
 * Module sans dépendance : utilisé par la création d'une école (règles actives)
 * et par la purge (lib/security/retention). La migration
 * 20260914170000_default_retention_policies pose les mêmes valeurs, inactives,
 * sur les écoles existantes.
 */
export type RetentionDataType =
    | "STUDENT_ACCOUNT"
    | "ACADEMIC_RECORDS"
    | "MEDICAL_RECORDS"
    | "ACCOUNTING"
    | "BADGE_SCAN_LOGS"
    | "AUDIT_LOGS"
    | "NOTIFICATIONS"
    | "MESSAGES";

export const DEFAULT_RETENTION_POLICIES: ReadonlyArray<{ dataType: RetentionDataType; months: number; description: string }> = [
    { dataType: "STUDENT_ACCOUNT", months: 12, description: "Compte de l'élève parti : accès fermé et coordonnées effacées. Le nom et le matricule restent au registre." },
    { dataType: "ACADEMIC_RECORDS", months: 60, description: "Notes et bulletins : l'élève parti est entièrement anonymisé." },
    { dataType: "MEDICAL_RECORDS", months: 12, description: "Dossier médical de l'élève parti : effacé." },
    { dataType: "ACCOUNTING", months: 120, description: "Pièces comptables (OHADA) : signalées au-delà de la durée, jamais supprimées automatiquement." },
    { dataType: "BADGE_SCAN_LOGS", months: 3, description: "Journaux d'accès aux badges : effacés." },
    { dataType: "AUDIT_LOGS", months: 60, description: "Journal d'audit : effacé." },
];

/** Règles actives pour une nouvelle école (création imbriquée Prisma). */
export function defaultRetentionPoliciesForNewSchool() {
    return DEFAULT_RETENTION_POLICIES.map((policy) => ({
        dataType: policy.dataType,
        retentionPeriod: policy.months,
        isActive: true,
        description: policy.description,
    }));
}
