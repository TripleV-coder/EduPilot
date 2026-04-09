import type { UserRole } from "@prisma/client";
import prisma from "@/lib/prisma";
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

export async function getAccessibleSchoolIdsForUser(input: {
  userId: string;
  role: UserRole;
  primarySchoolId: string | null;
}) {
  const { userId, role, primarySchoolId } = input;
  const organizationAccess = await getOrganizationAccessForUser(userId);

  // P2: SUPER_ADMIN intentionally gets an empty array here.
  // SUPER_ADMIN bypasses school-level filtering via getSchoolFilter() returning {} (no schoolId filter).
  // The empty array signals "no per-school restriction" — front-end code should use role checks, not this array.
  if (role === "SUPER_ADMIN") {
    return primarySchoolId ? [primarySchoolId] : [];
  }

  if (role === "TEACHER") {
    const [teacherSchoolIds, classSubjects, mainClasses] = await Promise.all([
      getTeacherSchoolIdsForUser({
        userId,
        primarySchoolId,
      }),
      prisma.classSubject.findMany({
        where: { teacher: { userId } },
        select: { class: { select: { schoolId: true } } },
      }),
      prisma.class.findMany({
        where: { mainTeacher: { userId } },
        select: { schoolId: true },
      }),
    ]);

    return uniqueSchoolIds(
      organizationAccess.accessibleSchoolIds,
      [primarySchoolId, ...teacherSchoolIds],
      classSubjects.map((assignment) => assignment.class.schoolId),
      mainClasses.map((schoolClass) => schoolClass.schoolId)
    );
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
      organizationAccess.accessibleSchoolIds,
      [primarySchoolId],
      (parentProfile?.parentStudents || []).map((link) => link.student.schoolId)
    );
  }

  if (role === "STUDENT") {
    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId },
      select: { schoolId: true },
    });

    return uniqueSchoolIds(organizationAccess.accessibleSchoolIds, [primarySchoolId, studentProfile?.schoolId]);
  }

  if (role === "SCHOOL_ADMIN" || role === "DIRECTOR") {
    if (!primarySchoolId) return uniqueSchoolIds(organizationAccess.accessibleSchoolIds);
    
    // Check if this school has annexes/children
    const school = await prisma.school.findUnique({
      where: { id: primarySchoolId },
      select: { siteType: true, childSchools: { select: { id: true } } }
    });

    if (school?.siteType === "MAIN" && school.childSchools.length > 0) {
      return uniqueSchoolIds(
        organizationAccess.accessibleSchoolIds,
        [primarySchoolId],
        school.childSchools.map(c => c.id)
      );
    }
  }

  return uniqueSchoolIds(organizationAccess.accessibleSchoolIds, [primarySchoolId]);
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
