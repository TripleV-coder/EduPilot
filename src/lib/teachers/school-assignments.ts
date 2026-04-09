import prisma from "@/lib/prisma";

function uniqueSchoolIds(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))
  );
}

export function normalizeTeacherSchoolIds(input: {
  primarySchoolId?: string | null;
  schoolId?: string | null;
  additionalSchoolIds?: string[] | null;
}) {
  const resolvedPrimarySchoolId = input.primarySchoolId ?? input.schoolId ?? null;
  const schoolIds = uniqueSchoolIds([
    resolvedPrimarySchoolId,
    ...(input.additionalSchoolIds || []),
  ]);

  return {
    primarySchoolId: resolvedPrimarySchoolId,
    schoolIds,
    additionalSchoolIds: resolvedPrimarySchoolId
      ? schoolIds.filter((schoolId) => schoolId !== resolvedPrimarySchoolId)
      : schoolIds,
  };
}

export function buildTeacherSchoolAssignments(input: {
  teacherId: string;
  userId: string;
  primarySchoolId: string;
  schoolIds: string[];
}) {
  return uniqueSchoolIds([input.primarySchoolId, ...input.schoolIds]).map((schoolId) => ({
    teacherId: input.teacherId,
    userId: input.userId,
    schoolId,
    status: "ACTIVE" as const,
    isPrimary: schoolId === input.primarySchoolId,
  }));
}

export function buildTeacherSchoolScope(schoolId: string) {
  return {
    OR: [
      { schoolId },
      {
        schoolAssignments: {
          some: {
            schoolId,
            status: "ACTIVE" as const,
          },
        },
      },
    ],
  };
}

export async function getTeacherSchoolIdsForUser(input: {
  userId: string;
  primarySchoolId?: string | null;
}) {
  const teacherProfile = await prisma.teacherProfile.findUnique({
    where: { userId: input.userId },
    select: {
      schoolId: true,
      schoolAssignments: {
        where: { status: "ACTIVE" },
        select: { schoolId: true },
      },
    },
  });

  return uniqueSchoolIds([
    input.primarySchoolId,
    teacherProfile?.schoolId,
    ...(teacherProfile?.schoolAssignments || []).map((assignment) => assignment.schoolId),
  ]);
}

export async function isTeacherAssignedToSchool(teacherId: string, schoolId: string) {
  const assignment = await prisma.teacherSchoolAssignment.findFirst({
    where: {
      teacherId,
      schoolId,
      status: "ACTIVE",
    },
    select: { id: true },
  });

  if (assignment) {
    return true;
  }

  const teacherProfile = await prisma.teacherProfile.findUnique({
    where: { id: teacherId },
    select: { schoolId: true },
  });

  return teacherProfile?.schoolId === schoolId;
}

export async function countTeachersForSchool(schoolId: string) {
  const [assignedTeachers, legacyTeachersWithoutAssignments] = await Promise.all([
    prisma.teacherSchoolAssignment.findMany({
      where: {
        schoolId,
        status: "ACTIVE",
      },
      select: { teacherId: true },
      distinct: ["teacherId"],
    }),
    prisma.teacherProfile.count({
      where: {
        schoolId,
        deletedAt: null,
        schoolAssignments: {
          none: {},
        },
      },
    }),
  ]);

  return assignedTeachers.length + legacyTeachersWithoutAssignments;
}
