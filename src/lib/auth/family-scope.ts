import prisma from "@/lib/prisma";

/**
 * Élèves dont un parent ou un élève peut consulter les données scolaires
 * (audits N9 / N10) : ses enfants liés, ou lui-même.
 * `null` pour les autres rôles (périmètre établissement, géré ailleurs).
 */
export async function getOwnStudentIds(role: string, userId: string): Promise<string[] | null> {
    if (role === "PARENT") {
        const parent = await prisma.parentProfile.findUnique({
            where: { userId },
            select: { parentStudents: { select: { studentId: true } } },
        });
        return parent?.parentStudents.map((link) => link.studentId) ?? [];
    }
    if (role === "STUDENT") {
        const student = await prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } });
        return student ? [student.id] : [];
    }
    return null;
}
