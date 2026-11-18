import prisma from "../owner-db";
import { uniqueCode } from "../helpers";

/**
 * Inscription ACTIVE de l'élève pour l'année en cours de son école (créée au
 * besoin), dans une classe de niveau `levelCode`. Depuis le parcours parent, la
 * famille ne peut payer qu'un frais qui concerne l'enfant : son année en cours
 * et son niveau (applicableFamilyFees). Renvoie l'année et le code de niveau.
 */
export async function enrollInCurrentYear(studentId: string, schoolId: string, levelCode = uniqueCode("NIV")) {
    const year =
        (await prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true } })) ??
        (await prisma.academicYear.create({
            data: { schoolId, name: uniqueCode("AN"), startDate: new Date("2026-09-01"), endDate: new Date("2027-07-31"), isCurrent: true },
        }));
    const level =
        (await prisma.classLevel.findFirst({ where: { schoolId, code: levelCode } })) ??
        (await prisma.classLevel.create({ data: { schoolId, name: levelCode, code: levelCode, level: "PRIMARY", sequence: 1 } }));
    const klass = await prisma.class.create({ data: { schoolId, classLevelId: level.id, name: uniqueCode("CL") } });
    await prisma.enrollment.create({ data: { studentId, classId: klass.id, academicYearId: year.id } });
    return { academicYearId: year.id, levelCode };
}
