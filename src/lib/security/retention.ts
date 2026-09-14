import { randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { anonymizeUser, ANONYMIZED_FIRST_NAME, ANONYMIZED_LAST_NAME } from "@/lib/security/rgpd";

/**
 * Conservation des données (Lot 6, N57) — une seule définition sert à l'aperçu
 * (`planRetention`) et à la purge (`enforceDataRetentionPolicies`) : ce que
 * l'aperçu annonce est exactement ce que la purge efface.
 *
 * Décisions du propriétaire (2026-09-14) : durées en MOIS, modifiables par
 * école ; comptées depuis le départ de l'élève — fin de l'année scolaire de sa
 * dernière inscription, aucune inscription en cours — : un élève inscrit n'est
 * jamais concerné. Comptabilité : 10 ans (OHADA), signalée, jamais supprimée
 * automatiquement (des soldes en dépendent).
 *
 * Avant : durées en années, dossiers médicaux effacés selon leur date de mise à
 * jour (élèves inscrits compris), départ ignoré, badges et journaux techniques
 * jamais purgés, erreurs avalées (console.error).
 */

export type RetentionAction = "deactivate" | "anonymize" | "delete" | "report";

export type RetentionDataType =
    | "STUDENT_ACCOUNT"
    | "ACADEMIC_RECORDS"
    | "MEDICAL_RECORDS"
    | "ACCOUNTING"
    | "BADGE_SCAN_LOGS"
    | "AUDIT_LOGS"
    | "NOTIFICATIONS"
    | "MESSAGES";

/** Durées par défaut décidées le 2026-09-14, dans l'ordre d'application. */
export const DEFAULT_RETENTION_POLICIES: ReadonlyArray<{ dataType: RetentionDataType; months: number; description: string }> = [
    { dataType: "STUDENT_ACCOUNT", months: 12, description: "Compte de l'élève parti : accès fermé et coordonnées effacées. Le nom et le matricule restent au registre." },
    { dataType: "ACADEMIC_RECORDS", months: 60, description: "Notes et bulletins : l'élève parti est entièrement anonymisé." },
    { dataType: "MEDICAL_RECORDS", months: 12, description: "Dossier médical de l'élève parti : effacé." },
    { dataType: "ACCOUNTING", months: 120, description: "Pièces comptables (OHADA) : signalées au-delà de la durée, jamais supprimées automatiquement." },
    { dataType: "BADGE_SCAN_LOGS", months: 3, description: "Journaux d'accès aux badges : effacés." },
    { dataType: "AUDIT_LOGS", months: 60, description: "Journal d'audit : effacé." },
];

/** Journaux techniques (télémétrie) : non rattachés à une école, purgés pour toute la plateforme. */
export const TECHNICAL_LOGS_MONTHS = 12;

const CLOSED_EMAIL_DOMAIN = "@anonymized.local";

export function retentionCutoff(months: number, now = new Date()): Date {
    const cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() - months);
    return cutoff;
}

/** Élèves partis avant la date limite : aucune inscription en cours, toutes sur des années terminées avant cette date. */
function departedBefore(schoolId: string, cutoff: Date): Prisma.StudentProfileWhereInput {
    return {
        schoolId,
        enrollments: {
            some: {},
            none: { status: { in: ["ACTIVE", "SUSPENDED"] } },
            every: { academicYear: { endDate: { lt: cutoff } } },
        },
    };
}

type Rule = {
    label: string;
    action: RetentionAction;
    count: (schoolId: string, cutoff: Date) => Promise<number>;
    apply: (schoolId: string, cutoff: Date) => Promise<number>;
};

const notClosed = (schoolId: string, cutoff: Date): Prisma.UserWhereInput => ({
    studentProfile: departedBefore(schoolId, cutoff),
    NOT: { email: { endsWith: CLOSED_EMAIL_DOMAIN } },
});

const notAnonymized = (schoolId: string, cutoff: Date): Prisma.UserWhereInput => ({
    studentProfile: departedBefore(schoolId, cutoff),
    NOT: { AND: [{ firstName: ANONYMIZED_FIRST_NAME }, { lastName: ANONYMIZED_LAST_NAME }] },
});

const auditLogsOf = (schoolId: string, cutoff: Date): Prisma.AuditLogWhereInput => ({
    OR: [{ schoolId }, { schoolId: null, user: { schoolId } }],
    createdAt: { lt: cutoff },
});

const RULES: Record<RetentionDataType, Rule> = {
    STUDENT_ACCOUNT: {
        label: "Comptes des élèves partis",
        action: "deactivate",
        count: (schoolId, cutoff) => prisma.user.count({ where: notClosed(schoolId, cutoff) }),
        apply: async (schoolId, cutoff) => {
            const users = await prisma.user.findMany({ where: notClosed(schoolId, cutoff), select: { id: true } });
            for (const { id } of users) {
                await prisma.user.update({
                    where: { id },
                    data: {
                        email: `departed_${id}${CLOSED_EMAIL_DOMAIN}`,
                        phone: null,
                        avatar: null,
                        isActive: false,
                        password: randomBytes(32).toString("hex"),
                        isTwoFactorEnabled: false,
                        twoFactorSecret: null,
                        twoFactorBackupCodes: [],
                    },
                });
            }
            return users.length;
        },
    },
    ACADEMIC_RECORDS: {
        label: "Notes et bulletins des élèves partis",
        action: "anonymize",
        count: (schoolId, cutoff) => prisma.user.count({ where: notAnonymized(schoolId, cutoff) }),
        apply: async (schoolId, cutoff) => {
            const users = await prisma.user.findMany({ where: notAnonymized(schoolId, cutoff), select: { id: true } });
            for (const { id } of users) await anonymizeUser(id, undefined, "RETENTION");
            return users.length;
        },
    },
    MEDICAL_RECORDS: {
        label: "Dossiers médicaux des élèves partis",
        action: "delete",
        count: (schoolId, cutoff) => prisma.medicalRecord.count({ where: { student: departedBefore(schoolId, cutoff) } }),
        apply: async (schoolId, cutoff) =>
            (await prisma.medicalRecord.deleteMany({ where: { student: departedBefore(schoolId, cutoff) } })).count,
    },
    ACCOUNTING: {
        label: "Pièces comptables",
        action: "report",
        count: (schoolId, cutoff) => prisma.payment.count({ where: { student: { schoolId }, createdAt: { lt: cutoff } } }),
        apply: async () => 0,
    },
    BADGE_SCAN_LOGS: {
        label: "Journaux d'accès aux badges",
        action: "delete",
        count: (schoolId, cutoff) => prisma.scanLog.count({ where: { schoolId, createdAt: { lt: cutoff } } }),
        apply: async (schoolId, cutoff) => (await prisma.scanLog.deleteMany({ where: { schoolId, createdAt: { lt: cutoff } } })).count,
    },
    AUDIT_LOGS: {
        label: "Journal d'audit",
        action: "delete",
        count: (schoolId, cutoff) => prisma.auditLog.count({ where: auditLogsOf(schoolId, cutoff) }),
        apply: async (schoolId, cutoff) => (await prisma.auditLog.deleteMany({ where: auditLogsOf(schoolId, cutoff) })).count,
    },
    NOTIFICATIONS: {
        label: "Notifications",
        action: "delete",
        count: (schoolId, cutoff) => prisma.notification.count({ where: { user: { schoolId }, createdAt: { lt: cutoff } } }),
        apply: async (schoolId, cutoff) =>
            (await prisma.notification.deleteMany({ where: { user: { schoolId }, createdAt: { lt: cutoff } } })).count,
    },
    MESSAGES: {
        label: "Messages",
        action: "delete",
        count: (schoolId, cutoff) => prisma.message.count({ where: { sender: { schoolId }, createdAt: { lt: cutoff } } }),
        apply: async (schoolId, cutoff) =>
            (await prisma.message.deleteMany({ where: { sender: { schoolId }, createdAt: { lt: cutoff } } })).count,
    },
};

const ORDER: RetentionDataType[] = [
    ...DEFAULT_RETENTION_POLICIES.map((policy) => policy.dataType),
    "NOTIFICATIONS",
    "MESSAGES",
];

function ruleFor(dataType: string): Rule | undefined {
    return (RULES as Record<string, Rule | undefined>)[dataType];
}

function byOrder<T extends { dataType: string }>(a: T, b: T): number {
    const rank = (dataType: string) => {
        const index = ORDER.indexOf(dataType as RetentionDataType);
        return index === -1 ? ORDER.length : index;
    };
    return rank(a.dataType) - rank(b.dataType);
}

export interface RetentionPlanItem {
    dataType: string;
    label: string;
    months: number;
    isActive: boolean;
    action: RetentionAction;
    /** Nombre d'éléments concernés à la date du jour (supprimés, anonymisés, fermés, ou signalés). */
    affected: number;
    /** Type inconnu du moteur : rien n'est effacé. */
    supported: boolean;
}

/** Aperçu, sans rien écrire : ce que la prochaine purge ferait pour cette école. */
export async function planRetention(schoolId: string): Promise<RetentionPlanItem[]> {
    const policies = await prisma.dataRetentionPolicy.findMany({ where: { schoolId } });
    const plan: RetentionPlanItem[] = [];
    for (const policy of [...policies].sort(byOrder)) {
        const rule = ruleFor(policy.dataType);
        plan.push({
            dataType: policy.dataType,
            label: rule?.label ?? policy.dataType,
            months: policy.retentionPeriod,
            isActive: policy.isActive,
            action: rule?.action ?? "report",
            affected: rule ? await rule.count(schoolId, retentionCutoff(policy.retentionPeriod)) : 0,
            supported: Boolean(rule),
        });
    }
    return plan;
}

export interface RetentionEnforcementResult {
    schoolId: string | null;
    school: string;
    dataType: string;
    action: RetentionAction;
    retentionMonths: number;
    /** Éléments supprimés, anonymisés ou fermés (0 pour une règle « report »). */
    deletedCount: number;
    error?: string;
}

/** Purge planifiée : toutes les règles actives de toutes les écoles, puis les journaux techniques. */
export async function enforceDataRetentionPolicies(): Promise<RetentionEnforcementResult[]> {
    const policies = await prisma.dataRetentionPolicy.findMany({
        where: { isActive: true },
        include: { school: { select: { id: true, name: true } } },
    });
    const results: RetentionEnforcementResult[] = [];

    for (const policy of [...policies].sort((a, b) => a.schoolId.localeCompare(b.schoolId) || byOrder(a, b))) {
        const rule = ruleFor(policy.dataType);
        const base = {
            schoolId: policy.schoolId,
            school: policy.school.name,
            dataType: policy.dataType,
            action: rule?.action ?? ("report" as const),
            retentionMonths: policy.retentionPeriod,
        };
        if (!rule) {
            results.push({ ...base, deletedCount: 0, error: "Type de donnée inconnu : rien n'a été effacé." });
            continue;
        }
        try {
            const deletedCount = await rule.apply(policy.schoolId, retentionCutoff(policy.retentionPeriod));
            results.push({ ...base, deletedCount });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error("Purge de conservation en échec", error, { module: "security/retention", schoolId: policy.schoolId, dataType: policy.dataType });
            results.push({ ...base, deletedCount: 0, error: message });
        }
    }

    try {
        const { count } = await prisma.telemetryEvent.deleteMany({ where: { createdAt: { lt: retentionCutoff(TECHNICAL_LOGS_MONTHS) } } });
        results.push({ schoolId: null, school: "Plateforme", dataType: "TECHNICAL_LOGS", action: "delete", retentionMonths: TECHNICAL_LOGS_MONTHS, deletedCount: count });
    } catch (error) {
        logger.error("Purge des journaux techniques en échec", error, { module: "security/retention" });
        results.push({
            schoolId: null,
            school: "Plateforme",
            dataType: "TECHNICAL_LOGS",
            action: "delete",
            retentionMonths: TECHNICAL_LOGS_MONTHS,
            deletedCount: 0,
            error: error instanceof Error ? error.message : String(error),
        });
    }

    return results;
}
