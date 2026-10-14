import prisma from "@/lib/prisma";

/** Classes où l'enseignant est affecté à une matière, ou professeur principal. */
export async function taughtClassIds(userId: string): Promise<string[]> {
  const teacher = await prisma.teacherProfile.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!teacher) return [];

  const [subjects, mainClasses] = await Promise.all([
    prisma.classSubject.findMany({
      where: { teacherId: teacher.id },
      select: { classId: true },
    }),
    prisma.class.findMany({
      where: { mainTeacherId: teacher.id },
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
