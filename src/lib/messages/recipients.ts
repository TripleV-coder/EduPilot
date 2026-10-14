import prisma from "@/lib/prisma";
import { taughtClassIds } from "@/lib/teachers/taught-classes";

export type MessageRecipient = {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
};

const USER_SELECT = { id: true, firstName: true, lastName: true, role: true } as const;

function dedupe(rows: MessageRecipient[], selfId: string): MessageRecipient[] {
  const map = new Map<string, MessageRecipient>();
  for (const row of rows) {
    if (row.id && row.id !== selfId) map.set(row.id, row);
  }
  return [...map.values()].sort((a, b) => a.lastName.localeCompare(b.lastName, "fr"));
}

async function schoolDirection(schoolId: string): Promise<MessageRecipient[]> {
  return prisma.user.findMany({
    where: { schoolId, isActive: true, role: { in: ["DIRECTOR", "SCHOOL_ADMIN"] } },
    select: USER_SELECT,
    take: 30,
  });
}

async function teachersOfClasses(classIds: string[]): Promise<MessageRecipient[]> {
  if (classIds.length === 0) return [];
  const assignments = await prisma.classSubject.findMany({
    where: { classId: { in: classIds }, teacherId: { not: null } },
    select: { teacher: { select: { user: { select: USER_SELECT } } } },
  });
  return assignments.flatMap((row) => (row.teacher?.user ? [row.teacher.user] : []));
}

/** Personnes à qui ce compte peut écrire un nouveau message. */
export async function listMessageRecipients(
  userId: string,
  role: string,
  schoolId: string | null | undefined,
): Promise<MessageRecipient[]> {
  if (!schoolId) return [];

  if (role === "SUPER_ADMIN" || role === "SCHOOL_ADMIN" || role === "DIRECTOR" || role === "NETWORK_ADMIN") {
    return prisma.user.findMany({
      where: { schoolId, isActive: true, id: { not: userId } },
      select: USER_SELECT,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 200,
    });
  }

  if (role === "PARENT") {
    const parent = await prisma.parentProfile.findUnique({
      where: { userId },
      select: {
        parentStudents: {
          select: {
            student: {
              select: {
                enrollments: {
                  where: { status: "ACTIVE" },
                  select: { classId: true },
                },
              },
            },
          },
        },
      },
    });
    const classIds = [
      ...new Set(parent?.parentStudents.flatMap((link) => link.student.enrollments.map((e) => e.classId)) ?? []),
    ];
    const [teachers, direction] = await Promise.all([teachersOfClasses(classIds), schoolDirection(schoolId)]);
    return dedupe([...teachers, ...direction], userId);
  }

  if (role === "STUDENT") {
    const student = await prisma.studentProfile.findUnique({
      where: { userId },
      select: { enrollments: { where: { status: "ACTIVE" }, select: { classId: true } } },
    });
    const classIds = student?.enrollments.map((e) => e.classId) ?? [];
    const [teachers, direction] = await Promise.all([teachersOfClasses(classIds), schoolDirection(schoolId)]);
    return dedupe([...teachers, ...direction], userId);
  }

  if (role === "TEACHER") {
    const classIds = await taughtClassIds(userId);
    const enrollments = classIds.length
      ? await prisma.enrollment.findMany({
          where: { classId: { in: classIds }, status: "ACTIVE" },
          select: {
            student: {
              select: {
                user: { select: USER_SELECT },
                parentStudents: { select: { parent: { select: { user: { select: USER_SELECT } } } } },
              },
            },
          },
        })
      : [];
    const people: MessageRecipient[] = [];
    for (const enrollment of enrollments) {
      people.push(enrollment.student.user);
      for (const link of enrollment.student.parentStudents) {
        if (link.parent.user) people.push(link.parent.user);
      }
    }
    const direction = await schoolDirection(schoolId);
    return dedupe([...people, ...direction], userId);
  }

  const [direction, teachers] = await Promise.all([
    schoolDirection(schoolId),
    prisma.user.findMany({
      where: { schoolId, isActive: true, role: "TEACHER", id: { not: userId } },
      select: USER_SELECT,
      take: 100,
    }),
  ]);
  return dedupe([...direction, ...teachers], userId);
}

export async function recipientIsAllowed(
  userId: string,
  role: string,
  schoolId: string | null | undefined,
  recipientId: string,
): Promise<boolean> {
  const recipients = await listMessageRecipients(userId, role, schoolId);
  return recipients.some((recipient) => recipient.id === recipientId);
}
