import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { classSubjectSchema } from "@/lib/validations/subject";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";
import { Permission } from "@/lib/rbac/permissions";
import { assertModelAccess, requireSchoolContext } from "@/lib/security/tenant";
import { isTeacherAssignedToSchool } from "@/lib/teachers/school-assignments";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

const batchSchema = z.object({
  assignments: z.array(classSubjectSchema).min(1),
});

const linkKey = (classId: string, subjectId: string) => `${classId}:${subjectId}`;

/**
 * POST /api/class-subjects/batch
 * Upsert + synchronisation des matières de chaque classe du lot.
 *
 * Audit M5 : la matière, l'enseignant et la liaison existante étaient relus
 * pour CHAQUE affectation, et chaque classe était écrite avant de valider la
 * suivante — une affectation refusée laissait les classes précédentes déjà
 * modifiées. Le lot est désormais entièrement validé (une requête par modèle,
 * erreurs dans le même ordre qu'avant), puis écrit dans une seule transaction.
 */
export const POST = createApiHandler(
  async (request, { session }, t) => {
    const body = await request.json();
    const validated = batchSchema.parse(body);

    const schoolContext = requireSchoolContext(session);
    if (schoolContext) return schoolContext;
    const activeSchoolId = getActiveSchoolId(session);
    const checksTenant = session.user.role !== "SUPER_ADMIN";

    const assignments = validated.assignments;
    const classIds = Array.from(new Set(assignments.map((a) => a.classId)));
    const subjectIds = Array.from(new Set(assignments.map((a) => a.subjectId)));
    const teacherIds = Array.from(
      new Set(assignments.map((a) => a.teacherId).filter((id): id is string => Boolean(id)))
    );

    const [subjects, teachers, existingLinks] = await Promise.all([
      checksTenant
        ? prisma.subject.findMany({ where: { id: { in: subjectIds } }, select: { id: true, schoolId: true } })
        : Promise.resolve([]),
      checksTenant && teacherIds.length > 0
        ? prisma.teacherProfile.findMany({ where: { id: { in: teacherIds } }, select: { id: true } })
        : Promise.resolve([]),
      prisma.classSubject.findMany({
        where: { classId: { in: classIds }, subjectId: { in: subjectIds } },
        select: { classId: true, subjectId: true },
      }),
    ]);
    const subjectSchools = new Map(subjects.map((subject) => [subject.id, subject.schoolId]));
    const knownTeachers = new Set(teachers.map((teacher) => teacher.id));
    const linkedKeys = new Set(existingLinks.map((link) => linkKey(link.classId, link.subjectId)));
    const teacherAssignments = new Map<string, boolean>();
    const writes: Prisma.PrismaPromise<unknown>[] = [];

    for (const classId of classIds) {
      const classAccess = await assertModelAccess(session, "class", classId, "Classe introuvable");
      if (classAccess) return classAccess;
      const schoolClass = await prisma.class.findUnique({
        where: { id: classId },
        select: { schoolId: true },
      });
      if (!schoolClass) {
        return NextResponse.json({ error: "Classe introuvable" }, { status: 404 });
      }

      const classAssignments = assignments.filter((a) => a.classId === classId);

      for (const assignment of classAssignments) {
        // En mode non-SUPER_ADMIN, on vérifie l'appartenance au même tenant (école).
        if (checksTenant) {
          const subjectSchoolId = subjectSchools.get(assignment.subjectId);
          if (!subjectSchoolId) {
            return NextResponse.json({ error: "Matière introuvable" }, { status: 404 });
          }
          if (subjectSchoolId !== schoolClass.schoolId) {
            return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
          }

          if (assignment.teacherId) {
            if (!knownTeachers.has(assignment.teacherId)) {
              return NextResponse.json({ error: "Enseignant introuvable" }, { status: 404 });
            }
            if (!activeSchoolId) {
              return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
            }
            const assignmentKey = linkKey(assignment.teacherId, schoolClass.schoolId);
            let assigned = teacherAssignments.get(assignmentKey);
            if (assigned === undefined) {
              assigned = await isTeacherAssignedToSchool(assignment.teacherId, schoolClass.schoolId);
              teacherAssignments.set(assignmentKey, assigned);
            }
            if (!assigned) {
              return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
            }
          }
        }

        const data = {
          teacherId: assignment.teacherId ?? null,
          coefficient: assignment.coefficient,
          weeklyHours: assignment.weeklyHours ?? null,
        };
        const key = linkKey(classId, assignment.subjectId);
        if (linkedKeys.has(key)) {
          writes.push(
            prisma.classSubject.update({
              where: { classId_subjectId: { classId, subjectId: assignment.subjectId } },
              data,
            })
          );
        } else {
          writes.push(prisma.classSubject.create({ data: { classId, subjectId: assignment.subjectId, ...data } }));
          linkedKeys.add(key); // une seconde occurrence dans le lot met à jour, comme avant
        }
      }

      // Sync/suppression : on supprime les matières non présentes dans la liste fournie.
      writes.push(
        prisma.classSubject.deleteMany({
          where: {
            classId,
            subjectId: { notIn: classAssignments.map((a) => a.subjectId) },
          },
        })
      );
    }

    try {
      await prisma.$transaction(writes);
    } catch (error) {
      // Création concurrente de la même liaison (contrainte classId + subjectId).
      if ((error as { code?: string } | null)?.code === "P2002") {
        return NextResponse.json(
          translateError(API_ERRORS.ALREADY_EXISTS("Matière assignée"), t),
          { status: 400 }
        );
      }
      throw error;
    }

    return NextResponse.json({ ok: true, processedClassCount: classIds.length }, { status: 200 });
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.SUBJECT_UPDATE],
  }
);
