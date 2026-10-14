/**
 * Lecture / écriture des paramètres de l'établissement (voir school-parameters.ts).
 * Stockés comme les règles de l'établissement (ConfigOption), chaque changement
 * tracé dans le journal (avant / après).
 */
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
    SCHOOL_PARAMETERS_CATEGORY,
    SCHOOL_PARAMETERS_CODE,
    resolveSchoolParameters,
    type SchoolParameters,
} from "@/lib/schools/school-parameters";

export async function getSchoolParameters(schoolId: string | null | undefined): Promise<SchoolParameters> {
    if (!schoolId) return resolveSchoolParameters(null);
    const option = await prisma.configOption.findFirst({
        where: { schoolId, category: SCHOOL_PARAMETERS_CATEGORY, code: SCHOOL_PARAMETERS_CODE, isActive: true },
        select: { metadata: true },
    });
    return resolveSchoolParameters(option?.metadata);
}

/** Paramètres de l'école d'un élève (analyses prédictives, alertes). */
export async function getSchoolParametersForStudent(studentId: string): Promise<SchoolParameters> {
    const student = await prisma.studentProfile.findUnique({ where: { id: studentId }, select: { schoolId: true } });
    return getSchoolParameters(student?.schoolId);
}

export async function saveSchoolParameters(
    schoolId: string,
    parameters: SchoolParameters,
    userId: string,
): Promise<SchoolParameters> {
    const before = await getSchoolParameters(schoolId);
    const metadata = parameters as unknown as Prisma.InputJsonValue;
    await prisma.$transaction([
        prisma.configOption.upsert({
            where: { schoolId_category_code: { schoolId, category: SCHOOL_PARAMETERS_CATEGORY, code: SCHOOL_PARAMETERS_CODE } },
            create: { schoolId, category: SCHOOL_PARAMETERS_CATEGORY, code: SCHOOL_PARAMETERS_CODE, label: "Paramètres de l'établissement", metadata },
            update: { metadata, isActive: true },
        }),
        prisma.auditLog.create({
            data: {
                userId,
                schoolId,
                action: "SCHOOL_PARAMETERS_UPDATED",
                entity: "SchoolParameters",
                entityId: schoolId,
                oldValues: before as unknown as Prisma.InputJsonValue,
                newValues: metadata,
            },
        }),
    ]);
    return parameters;
}
