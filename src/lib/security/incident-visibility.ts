import type { Prisma } from "@prisma/client";
import type { Session } from "next-auth";
import prisma from "@/lib/prisma";

/**
 * Incidents de discipline visibles par l'utilisateur, en plus du périmètre
 * d'établissement (assertModelAccess / filtre d'école) : une seule règle pour
 * la liste, le détail et la modification.
 *
 * - élève : les siens ; parent : ceux de ses enfants (liens en base) ;
 * - enseignant : ceux qu'il a signalés ;
 * - personnel de l'établissement (administration, direction, comptabilité,
 *   personnel) et super-administrateur : tous, dans leur périmètre d'école.
 *
 * `null` : rien n'est visible (élève sans fiche, parent sans enfant lié).
 */
export async function incidentVisibilityWhere(session: Session): Promise<Prisma.BehaviorIncidentWhereInput | null> {
    const { role, id: userId } = session.user;
    if (role === "STUDENT") {
        const student = await prisma.studentProfile.findUnique({ where: { userId }, select: { id: true } });
        return student ? { studentId: student.id } : null;
    }
    if (role === "PARENT") {
        const parent = await prisma.parentProfile.findUnique({
            where: { userId },
            select: { parentStudents: { select: { studentId: true } } },
        });
        const children = parent?.parentStudents.map((link) => link.studentId) ?? [];
        return children.length > 0 ? { studentId: { in: children } } : null;
    }
    if (role === "TEACHER") return { reportedById: userId };
    return {};
}
