import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import prisma from "@/lib/prisma";
import type { AttendanceStatus } from "@prisma/client";
import { invalidateByPath } from "@/lib/api/cache-helpers";
import { guardAttendanceDateWritable } from "@/lib/academic/year-lock";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { syncAnalyticsAfterStudentActivityChange } from "@/lib/services/analytics-sync";
import { logger } from "@/lib/utils/logger";
import { z } from "zod";
import { notifyParentsOfAbsences, type AbsenceChange } from "@/lib/attendance/notify-parents";

const bulkAttendanceSchema = z.object({
  classId: z.string().min(1),
  date: z.string().min(1).refine((value) => !Number.isNaN(new Date(value).getTime()), "Date invalide"),
  records: z
    .array(
      z.object({
        studentId: z.string().min(1),
        status: z.enum(["PRESENT", "LATE", "ABSENT", "EXCUSED"] satisfies AttendanceStatus[]),
        notes: z.string().max(500).optional(),
      }),
    )
    .min(1, "Aucun enregistrement fourni"),
});

/**
 * API Endpoint for bulk attendance recording
 */

export const POST = createApiHandler(
  async (request, context) => {
  try {
    const session = context.session;
// Only teachers and admins can record attendance
const parsed = bulkAttendanceSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { error: issue?.message === "Aucun enregistrement fourni" ? issue.message : "Données d'appel invalides (classe, date ou statut)." },
        { status: 400 }
      );
    }
    const { records, classId, date } = parsed.data;

    // Verify class belongs to user's school
    const classRecord = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        classSubjects: { select: { teacherId: true } },
        mainTeacher: { select: { userId: true } }
      }
    });

    if (!classRecord) {
      return NextResponse.json({ error: "Classe non trouvée" }, { status: 404 });
    }

    if (session.user.role !== "SUPER_ADMIN" && !canAccessSchool(session, classRecord.schoolId)) {
      return NextResponse.json(
        { error: "Accès non autorisé à cette classe" },
        { status: 403 }
      );
    }

    const yearLock = await guardAttendanceDateWritable(classRecord.schoolId, new Date(date));
    if (yearLock) return yearLock;

    if (session.user.role === "TEACHER") {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id }
      });
      const isTeachingClass = classRecord.mainTeacher?.userId === session.user.id || classRecord.classSubjects.some(cs => cs.teacherId === teacherProfile?.id);

      if (!isTeachingClass) {
        return NextResponse.json({ error: "Accès refusé: Vous n'enseignez pas dans cette classe" }, { status: 403 });
      }
    }

    // Anti-Fraud Check: Ensure all submitted students are actually enrolled in the class
    const uniqueStudentIds = [...new Set(records.map((r) => r.studentId))];
    const validEnrollmentsCount = await prisma.enrollment.count({
      where: {
        studentId: { in: uniqueStudentIds },
        classId: classId,
        status: "ACTIVE"
      }
    });

    if (validEnrollmentsCount !== uniqueStudentIds.length) {
      return NextResponse.json(
        { error: "Opération bloquée: Tentative de pointer des étudiants non inscrits dans cette classe." },
        { status: 400 }
      );
    }

    // Create or update attendance records
    // Compound unique includes nullable timeSlot, so we use findFirst + create/update
    // Élèves qui DEVIENNENT absents ou en retard : seuls eux déclenchent un
    // avertissement aux familles (un réenregistrement ne re-notifie pas).
    const becameAbsent: AbsenceChange[] = [];
    const results = await prisma.$transaction(
      async (tx) => {
        const ops = [];
        for (const record of records) {
          const existing = await tx.attendance.findFirst({
            where: {
              studentId: record.studentId,
              classId,
              date: new Date(date),
              timeSlot: null,
            },
          });
          if ((record.status === "ABSENT" || record.status === "LATE") && existing?.status !== record.status) {
            becameAbsent.push({ studentId: record.studentId, status: record.status });
          }
          if (existing) {
            ops.push(
              tx.attendance.update({
                where: { id: existing.id },
                data: {
                  status: record.status,
                  reason: record.notes,
                  recordedById: session.user.id,
                },
              })
            );
          } else {
            ops.push(
              tx.attendance.create({
                data: {
                  studentId: record.studentId,
                  classId,
                  date: new Date(date),
                  status: record.status,
                  reason: record.notes,
                  recordedById: session.user.id,
                },
              })
            );
          }
        }
        return Promise.all(ops);
      }
    );

    await syncAnalyticsAfterStudentActivityChange(
      records.map((record) => record.studentId),
      new Date(date)
    );
    await Promise.all([
      invalidateByPath("/api/analytics"),
      invalidateByPath("/api/attendance/stats"),
    ]);

    logger.info(`Bulk attendance: ${results.length} records saved by ${session.user.id}`);

    // L'appel est enregistré : prévenir les familles ne doit jamais le faire échouer.
    await notifyParentsOfAbsences({ schoolId: classRecord.schoolId, date: new Date(date), changes: becameAbsent }).catch(
      (error) => logger.error("Avertissement des familles impossible", error as Error),
    );

    return NextResponse.json({
      success: true,
      count: results.length,
      message: `${results.length} enregistrements sauvegardés`,
    });
  } catch (error) {
    logger.error("Bulk attendance error:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement des présences" },
      { status: 500 }
    );
  }

  },
  { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] }
);

// GET endpoint to fetch bulk attendance data for a class
export const GET = createApiHandler(
  async (request, context) => {
  try {
    const session = context.session;
const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const date = searchParams.get("date");

    if (!classId || !date) {
      return NextResponse.json(
        { error: "ID de classe et date requis" },
        { status: 400 }
      );
    }

    // Protection Multi-Tenant
    const targetClass = await prisma.class.findUnique({
      where: { id: classId },
      select: { schoolId: true }
    });

    if (!targetClass) {
      return NextResponse.json({ error: "Classe non trouvée" }, { status: 404 });
    }

    if (session.user.role !== "SUPER_ADMIN" && !canAccessSchool(session, targetClass.schoolId)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Fetch existing attendance for this class and date
    const attendance = await prisma.attendance.findMany({
      where: {
        classId,
        date: new Date(date),
      },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    return NextResponse.json(attendance);
  } catch (error) {
    logger.error("Fetch bulk attendance error:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des présences" },
      { status: 500 }
    );
  }

  }
);
