import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { classSubjectSchema } from "@/lib/validations/subject";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";
import { Permission } from "@/lib/rbac/permissions";
import { assertModelAccess, requireSchoolContext } from "@/lib/security/tenant";

const batchSchema = z.object({
  assignments: z.array(classSubjectSchema).min(1),
});

export const POST = createApiHandler(
  async (request, { session }, t) => {
    const body = await request.json();
    const validated = batchSchema.parse(body);

    const schoolContext = requireSchoolContext(session);
    if (schoolContext) return schoolContext;

    const assignments = validated.assignments;
    const classIds = Array.from(new Set(assignments.map((a) => a.classId)));

    for (const classId of classIds) {
      const classAccess = await assertModelAccess(session, "class", classId, "Classe introuvable");
      if (classAccess) return classAccess;

      const classAssignments = assignments.filter((a) => a.classId === classId);
      const subjectIds = classAssignments.map((a) => a.subjectId);

      // Upsert + sync: on réconcilie tout ce qui est envoyé.
      for (const assignment of classAssignments) {
        // En mode non-SUPER_ADMIN, on vérifie l'appartenance au même tenant (école).
        if (session.user.role !== "SUPER_ADMIN") {
          const subject = await prisma.subject.findUnique({
            where: { id: assignment.subjectId },
            select: { schoolId: true },
          });

          if (!subject) {
            return NextResponse.json({ error: "Matière introuvable" }, { status: 404 });
          }
          if (subject.schoolId !== session.user.schoolId) {
            return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
          }

          if (assignment.teacherId) {
            const teacher = await prisma.teacherProfile.findUnique({
              where: { id: assignment.teacherId },
              select: { schoolId: true },
            });
            if (!teacher) {
              return NextResponse.json({ error: "Enseignant introuvable" }, { status: 404 });
            }
            if (teacher.schoolId !== session.user.schoolId) {
              return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
            }
          }
        }

        const existing = await prisma.classSubject.findFirst({
          where: { classId: assignment.classId, subjectId: assignment.subjectId },
        });

        const teacherId = assignment.teacherId ?? null;
        const weeklyHours = assignment.weeklyHours ?? null;

        if (existing) {
          await prisma.classSubject.update({
            where: { id: existing.id },
            data: {
              teacherId,
              coefficient: assignment.coefficient,
              weeklyHours,
            },
          });
        } else {
          // Même s'il existe déjà un (classId, subjectId), on protège contre les courses.
          const alreadyExists = await prisma.classSubject.findFirst({
            where: { classId: assignment.classId, subjectId: assignment.subjectId },
          });
          if (alreadyExists) {
            return NextResponse.json(
              translateError(API_ERRORS.ALREADY_EXISTS("Matière assignée"), t),
              { status: 400 }
            );
          }

          await prisma.classSubject.create({
            data: {
              classId: assignment.classId,
              subjectId: assignment.subjectId,
              teacherId,
              coefficient: assignment.coefficient,
              weeklyHours,
            },
          });
        }
      }

      // Sync/suppression : on supprime les matières non présentes dans la liste fournie.
      await prisma.classSubject.deleteMany({
        where: {
          classId,
          subjectId: { notIn: subjectIds },
        },
      });
    }

    return NextResponse.json({ ok: true, processedClassCount: classIds.length }, { status: 200 });
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.SUBJECT_UPDATE],
  }
);

