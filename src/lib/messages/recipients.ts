import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { taughtClassIds } from "@/lib/teachers/taught-classes";

/**
 * Qui peut écrire à qui (nouveau message ; une réponse suit le fil).
 *
 * Le périmètre est UN filtre de base (`recipientScope`), utilisé à la fois
 * pour la recherche de destinataires et pour l'autorisation d'envoi : les
 * deux ne peuvent pas diverger. Avant (2026-11-08), l'autorisation relisait la
 * liste affichée, plafonnée à 200 noms : dans une école de 2 600 comptes, la
 * direction ne pouvait écrire qu'aux noms de « A » à « Ah… » (envoi refusé,
 * 403, à un parent nommé Zinsou).
 *
 *  - direction (et administrateurs) : tous les comptes actifs de l'école ;
 *  - enseignant : élèves et parents de ses classes (écoles où il est
 *    rattaché, école active seulement — audit MS-01, F3), et la direction ;
 *  - parent / élève : enseignants des classes des enfants (ou des siennes),
 *    et la direction ;
 *  - autres rôles (personnel, comptable…) : direction et enseignants.
 * Comptes désactivés exclus (l'envoi leur serait refusé de toute façon).
 */
export type MessageRecipient = {
  id: string;
  firstName: string;
  lastName: string;
  /** Distingue les homonymes dans le choix du destinataire. */
  email: string;
  role: string;
};

const USER_SELECT = { id: true, firstName: true, lastName: true, email: true, role: true } as const;
const DIRECTION_ROLES = new Set(["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "NETWORK_ADMIN"]);

/** Résultats renvoyés par défaut / au plus par une recherche. */
export const RECIPIENTS_PAGE = 50;
export const RECIPIENTS_MAX = 100;

const directionOf = (schoolId: string): Prisma.UserWhereInput => ({
  schoolId,
  role: { in: ["DIRECTOR", "SCHOOL_ADMIN"] },
});

const teachersOf = (classIds: string[]): Prisma.UserWhereInput => ({
  teacherProfile: { classSubjects: { some: { classId: { in: classIds } } } },
});

/** Filtre des destinataires permis ; `null` : personne (pas d'école active). */
export async function recipientScope(
  userId: string,
  role: string,
  schoolId: string | null | undefined,
): Promise<Prisma.UserWhereInput | null> {
  if (!schoolId) return null;
  const base: Prisma.UserWhereInput = { isActive: true, id: { not: userId } };

  if (DIRECTION_ROLES.has(role)) return { ...base, schoolId };

  if (role === "PARENT" || role === "STUDENT") {
    const enrollments = await prisma.enrollment.findMany({
      where: {
        status: "ACTIVE",
        student: role === "PARENT" ? { parentStudents: { some: { parent: { userId } } } } : { userId },
      },
      select: { classId: true },
    });
    const classIds = [...new Set(enrollments.map((e) => e.classId))];
    return { ...base, OR: [teachersOf(classIds), directionOf(schoolId)] };
  }

  if (role === "TEACHER") {
    const classIds = await taughtClassIds(userId);
    const inMyClasses: Prisma.EnrollmentWhereInput = { classId: { in: classIds }, status: "ACTIVE", class: { schoolId } };
    return {
      ...base,
      OR: [
        { studentProfile: { enrollments: { some: inMyClasses } } },
        { parentProfile: { parentStudents: { some: { student: { enrollments: { some: inMyClasses } } } } } },
        directionOf(schoolId),
      ],
    };
  }

  return { ...base, schoolId, role: { in: ["DIRECTOR", "SCHOOL_ADMIN", "TEACHER"] } };
}

/** Recherche sur prénom, nom ou e-mail : chaque mot doit correspondre. */
function searchFilter(query: string | undefined): Prisma.UserWhereInput | undefined {
  const terms = (query ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 5);
  if (terms.length === 0) return undefined;
  return {
    AND: terms.map((term) => ({
      OR: [
        { firstName: { contains: term, mode: "insensitive" as const } },
        { lastName: { contains: term, mode: "insensitive" as const } },
        { email: { contains: term, mode: "insensitive" as const } },
      ],
    })),
  };
}

/** Destinataires permis (triés par nom), filtrés par `query` ; `total` = nombre de correspondances. */
export async function listMessageRecipients(
  userId: string,
  role: string,
  schoolId: string | null | undefined,
  options: { query?: string; take?: number } = {},
): Promise<{ data: MessageRecipient[]; total: number }> {
  const scope = await recipientScope(userId, role, schoolId);
  if (!scope) return { data: [], total: 0 };
  const search = searchFilter(options.query);
  const where: Prisma.UserWhereInput = search ? { AND: [scope, search] } : scope;
  const take = Math.min(Math.max(1, options.take ?? RECIPIENTS_PAGE), RECIPIENTS_MAX);
  const [data, total] = await Promise.all([
    prisma.user.findMany({ where, select: USER_SELECT, orderBy: [{ lastName: "asc" }, { firstName: "asc" }], take }),
    prisma.user.count({ where }),
  ]);
  return { data, total };
}

/** Vrai si ce compte peut écrire à `recipientId` (une requête ciblée, sans plafond). */
export async function recipientIsAllowed(
  userId: string,
  role: string,
  schoolId: string | null | undefined,
  recipientId: string,
): Promise<boolean> {
  const scope = await recipientScope(userId, role, schoolId);
  if (!scope) return false;
  return (await prisma.user.count({ where: { AND: [scope, { id: recipientId }] } })) > 0;
}
