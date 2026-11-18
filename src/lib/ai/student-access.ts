import type { Session } from "next-auth";
import prisma from "@/lib/prisma";
import { roleSatisfies } from "@/lib/rbac/permissions";
import { teacherTeachesStudent } from "@/lib/teachers/taught-classes";

/**
 * Qui peut lancer une analyse IA sur UN élève (hors contrôle d'école, fait par
 * chaque route) :
 * - direction (SUPER_ADMIN, SCHOOL_ADMIN — et NETWORK_ADMIN par héritage —, DIRECTOR) : tout élève ;
 * - enseignant : seulement un élève inscrit dans une de SES classes (TD-020,
 *   même règle que les analyses de classe) ;
 * - parent : ses enfants ; élève : lui-même (si `allowFamily`) ;
 * - tout autre rôle (comptable, personnel…) : refusé.
 *
 * Renvoie le message de refus, ou null si l'accès est permis.
 */
export async function aiStudentAccessDenied(
  session: Session,
  student: { id: string; userId: string },
  options: { allowFamily?: boolean } = {},
): Promise<string | null> {
  const role = session.user.role;

  if (roleSatisfies(role, ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"])) return null;

  if (role === "TEACHER") {
    return (await teacherTeachesStudent(session.user.id, student.id))
      ? null
      : "Accès refusé : cet élève n'est pas dans vos classes";
  }

  if (options.allowFamily && role === "STUDENT") {
    return student.userId === session.user.id ? null : "Accès refusé";
  }

  if (options.allowFamily && role === "PARENT") {
    const link = await prisma.parentStudent.findFirst({
      where: { studentId: student.id, parent: { userId: session.user.id } },
      select: { id: true },
    });
    return link ? null : "Accès refusé : vous n'êtes pas le parent de cet élève";
  }

  return "Accès refusé";
}
