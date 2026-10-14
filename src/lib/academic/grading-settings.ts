/**
 * Règles de l'établissement — tout ce qu'une école peut régler elle-même
 * (docs/guide-utilisateur/03-configuration.md). Principes :
 *   - des CHOIX BORNÉS (listes d'options, nombres encadrés), jamais de formule libre ;
 *   - les règles officielles du Bénin par défaut ;
 *   - validation stricte et cohérence (seuils croissants, poids compatibles…) ;
 *   - chaque changement est tracé (journal d'audit, avant / après) ;
 *   - les règles en vigueur sont gelées avec le conseil de classe validé.
 * Stockées comme les règles du conseil (ConfigOption). Le seuil de passage
 * reste celui de la configuration académique (passingGrade).
 */
import prisma from "@/lib/prisma";
import {
    GRADING_SETTINGS_CATEGORY,
    GRADING_SETTINGS_CODE as CODE,
    resolveGradingSettings,
    type GradingSettings,
} from "@/lib/academic/grading-rules";

export * from "@/lib/academic/grading-rules";

export async function getGradingSettings(schoolId: string): Promise<GradingSettings> {
    const option = await prisma.configOption.findFirst({
        where: { schoolId, category: GRADING_SETTINGS_CATEGORY, code: CODE, isActive: true },
        select: { metadata: true },
    });
    return resolveGradingSettings(option?.metadata);
}

/** Enregistre les règles (déjà validées) et trace le changement (avant / après). */
export async function saveGradingSettings(
    schoolId: string,
    settings: GradingSettings,
    userId: string,
): Promise<GradingSettings> {
    const before = await getGradingSettings(schoolId);
    await prisma.$transaction([
        prisma.configOption.upsert({
            where: { schoolId_category_code: { schoolId, category: GRADING_SETTINGS_CATEGORY, code: CODE } },
            create: {
                schoolId,
                category: GRADING_SETTINGS_CATEGORY,
                code: CODE,
                label: "Règles de l'établissement",
                metadata: settings,
            },
            update: { metadata: settings, isActive: true },
        }),
        prisma.auditLog.create({
            data: {
                userId,
                schoolId,
                action: "SCHOOL_RULES_UPDATED",
                entity: "SchoolRules",
                entityId: schoolId,
                oldValues: before,
                newValues: settings,
            },
        }),
    ]);
    return settings;
}

/** Seuil de passage de l'établissement (configuration académique), 10 par défaut. */
export async function getPassingGrade(schoolId: string): Promise<number> {
    const config = await prisma.academicConfig.findUnique({ where: { schoolId }, select: { passingGrade: true } });
    return config ? Number(config.passingGrade) : 10;
}

/** Seuil de passage de l'école d'un élève (10 si l'élève ou la configuration manquent). */
export async function passingGradeForStudent(studentId: string): Promise<number> {
    const student = await prisma.studentProfile.findUnique({ where: { id: studentId }, select: { schoolId: true } });
    return student?.schoolId ? getPassingGrade(student.schoolId) : 10;
}

