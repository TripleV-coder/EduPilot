import type { Session } from "next-auth";
import { taughtClassIds } from "@/lib/teachers/taught-classes";
import { getOwnStudentIds } from "@/lib/auth/family-scope";

/**
 * Lecture des notes (MS-02, 2026-10-18) — l'école seule ne suffit pas :
 * - enseignant : classes où il enseigne une matière ou dont il est
 *   professeur principal (même règle que la liste des élèves) ;
 * - parent, élève : ses propres élèves ;
 * - direction, administration : périmètre d'école, contrôlé en amont.
 */

/** Classes lisibles par un enseignant ; null pour les autres rôles (pas de restriction de classe). */
export async function teacherReadableClassIds(session: Session): Promise<string[] | null> {
    return session.user.role === "TEACHER" ? taughtClassIds(session.user.id) : null;
}

/** Vrai si la note (élève, classe) est hors de ce que l'utilisateur peut lire. */
export async function gradeReadDenied(session: Session, target: { studentId: string; classId: string }): Promise<boolean> {
    const classIds = await teacherReadableClassIds(session);
    if (classIds && !classIds.includes(target.classId)) return true;
    const ownIds = await getOwnStudentIds(session.user.role, session.user.id);
    if (ownIds && !ownIds.includes(target.studentId)) return true;
    return false;
}
