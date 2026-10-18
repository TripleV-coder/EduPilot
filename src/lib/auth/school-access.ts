import type { UserRole } from "@prisma/client";
import prisma from "@/lib/prisma";
import { runAsSystem } from "@/lib/db/db-context";
import { getOrganizationAccessForUser } from "@/lib/auth/organization-access";
import { getTeacherSchoolIdsForUser } from "@/lib/teachers/school-assignments";

function uniqueSchoolIds(...groups: Array<Array<string | null | undefined>>) {
  return Array.from(
    new Set(
      groups
        .flat()
        .filter((schoolId): schoolId is string => typeof schoolId === "string" && schoolId.length > 0)
    )
  );
}

type SchoolAccessInput = {
  userId: string;
  role: UserRole;
  primarySchoolId: string | null;
};

/**
 * Établissements accessibles, calculés à la connexion et au changement
 * d'école. Contexte système déclaré (audit M2) : c'est ce calcul qui fonde le
 * contexte d'établissement des requêtes suivantes ; il lit l'école de l'élève
 * ou des enfants d'un parent, que la RLS masquerait sans contexte.
 */
export function getAccessibleSchoolIdsForUser(input: SchoolAccessInput) {
  return runAsSystem("auth:school-access", () => computeAccessibleSchoolIds(input));
}

async function computeAccessibleSchoolIds(input: SchoolAccessInput) {
  const { userId, role, primarySchoolId } = input;

  // P2: SUPER_ADMIN intentionally gets an empty array here.
  // SUPER_ADMIN bypasses school-level filtering via getSchoolFilter() returning {} (no schoolId filter).
  // The empty array signals "no per-school restriction" — front-end code should use role checks, not this array.
  if (role === "SUPER_ADMIN") {
    return primarySchoolId ? [primarySchoolId] : [];
  }

  // Souveraineté des écoles (S5) : l'adhésion à une organisation n'ouvre les
  // données des écoles du réseau qu'au NETWORK_ADMIN, patron du groupe
  // (spécification 2026-07-02). Pour tout autre rôle — y compris un
  // propriétaire ou gestionnaire d'organisation SCHOOL_ADMIN ou DIRECTOR —
  // l'adhésion ne donne que des fonctions organisationnelles, jamais l'accès
  // aux élèves, notes, frais ou paiements d'une école voisine.
  if (role === "NETWORK_ADMIN") {
    const organizationAccess = await getOrganizationAccessForUser(userId);
    return uniqueSchoolIds(organizationAccess.accessibleSchoolIds, [primarySchoolId], await annexesOf(primarySchoolId));
  }

  // Un rattachement actif (ou l'école principale) est NÉCESSAIRE : les cours
  // et classes confiés ne donnent jamais, à eux seuls, accès à une école dont
  // le rattachement a été désactivé (audit MS-01). Ils déterminent ensuite,
  // dans chaque route, les classes accessibles.
  if (role === "TEACHER") {
    const teacherSchoolIds = await getTeacherSchoolIdsForUser({ userId, primarySchoolId });
    return uniqueSchoolIds([primarySchoolId, ...teacherSchoolIds]);
  }

  if (role === "PARENT") {
    const parentProfile = await prisma.parentProfile.findUnique({
      where: { userId },
      select: {
        parentStudents: {
          select: {
            student: {
              select: { schoolId: true },
            },
          },
        },
      },
    });

    return uniqueSchoolIds(
      [primarySchoolId],
      (parentProfile?.parentStudents || []).map((link) => link.student.schoolId)
    );
  }

  if (role === "STUDENT") {
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId },
      select: { schoolId: true },
    });

    return uniqueSchoolIds([primarySchoolId, studentProfile?.schoolId]);
  }

  // Site principal : ses annexes font partie du même établissement
  if (role === "SCHOOL_ADMIN" || role === "DIRECTOR") {
    return uniqueSchoolIds([primarySchoolId], await annexesOf(primarySchoolId));
  }

  return uniqueSchoolIds([primarySchoolId]);
}

/** Annexes d'un site principal (même établissement) ; aucune pour une annexe ou une école simple. */
async function annexesOf(schoolId: string | null): Promise<string[]> {
  if (!schoolId) return [];
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: { siteType: true, childSchools: { select: { id: true } } },
  });
  return school?.siteType === "MAIN" ? school.childSchools.map((child) => child.id) : [];
}

export function resolveActiveSchoolId(input: {
  primarySchoolId: string | null;
  accessibleSchoolIds: string[];
  requestedSchoolId?: string | null;
}) {
  const { primarySchoolId, accessibleSchoolIds, requestedSchoolId } = input;

  if (requestedSchoolId && accessibleSchoolIds.includes(requestedSchoolId)) {
    return requestedSchoolId;
  }

  if (primarySchoolId && accessibleSchoolIds.includes(primarySchoolId)) {
    return primarySchoolId;
  }

  return accessibleSchoolIds[0] ?? primarySchoolId ?? null;
}
