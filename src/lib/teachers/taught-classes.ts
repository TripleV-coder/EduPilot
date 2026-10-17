import prisma from "@/lib/prisma";

/**
 * Classes où l'enseignant est affecté à une matière, ou professeur principal,
 * dans les seules écoles où il est rattaché (école principale ou rattachement
 * actif). Un cours conservé en historique dans une école quittée n'ouvre plus
 * rien (audit MS-01, F3) ; l'affectation elle-même n'est pas supprimée.
 */
export async function taughtClassIds(userId: string): Promise<string[]> {
  const teacher = await prisma.teacherProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      schoolId: true,
      user: { select: { schoolId: true } },
      schoolAssignments: { where: { status: "ACTIVE" }, select: { schoolId: true } },
    },
  });
  if (!teacher) return [];

  const schoolIds = [
    ...new Set(
      [teacher.user.schoolId, teacher.schoolId, ...teacher.schoolAssignments.map((a) => a.schoolId)].filter(
        (id): id is string => typeof id === "string" && id.length > 0,
      ),
    ),
  ];

  const [subjects, mainClasses] = await Promise.all([
    prisma.classSubject.findMany({
      where: { teacherId: teacher.id, class: { schoolId: { in: schoolIds } } },
      select: { classId: true },
    }),
    prisma.class.findMany({
      where: { mainTeacherId: teacher.id, schoolId: { in: schoolIds } },
      select: { id: true },
    }),
  ]);

  return [...new Set([...subjects.map((row) => row.classId), ...mainClasses.map((row) => row.id)])];
}

/** Vrai si l'élève a une inscription active dans une classe de cet enseignant. */
export async function teacherTeachesStudent(userId: string, studentId: string): Promise<boolean> {
  const classIds = await taughtClassIds(userId);
  if (classIds.length === 0) return false;
  const count = await prisma.enrollment.count({
    where: { studentId, classId: { in: classIds }, status: "ACTIVE" },
  });
  return count > 0;
}
