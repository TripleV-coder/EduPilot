import prisma from "@/lib/prisma";

export interface FamilyStudent {
    id: string;
    firstName: string;
}

/**
 * Élèves pour lesquels la personne connectée agit sur une inscription à un
 * évènement : elle-même (élève) ou ses enfants rattachés (parent).
 */
export async function familyStudents(user: { id: string; role: string }): Promise<FamilyStudent[]> {
    if (user.role === "STUDENT") {
        const own = await prisma.studentProfile.findMany({
            where: { userId: user.id },
            select: { id: true, user: { select: { firstName: true } } },
        });
        return own.map((s) => ({ id: s.id, firstName: s.user.firstName }));
    }
    if (user.role === "PARENT") {
        const parent = await prisma.parentProfile.findUnique({
            where: { userId: user.id },
            select: { parentStudents: { select: { student: { select: { id: true, user: { select: { firstName: true } } } } } } },
        });
        return (parent?.parentStudents ?? []).map((ps) => ({ id: ps.student.id, firstName: ps.student.user.firstName }));
    }
    return [];
}
