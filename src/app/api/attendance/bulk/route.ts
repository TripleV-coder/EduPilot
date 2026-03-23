import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { invalidateByPath } from "@/lib/api/cache-helpers";
import { syncAnalyticsAfterStudentActivityChange } from "@/lib/services/analytics-sync";
import { logger } from "@/lib/utils/logger";

/**
 * API Endpoint for bulk attendance recording
 */

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Only teachers and admins can record attendance
    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];
    if (!allowedRoles.includes(session.user.role as string)) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const body = await request.json();
    const { records, classId, date } = body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { error: "Aucun enregistrement fourni" },
        { status: 400 }
      );
    }

    if (!classId || !date) {
      return NextResponse.json(
        { error: "ID de classe et date requis" },
        { status: 400 }
      );
    }

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

    if (session.user.role !== "SUPER_ADMIN" && classRecord.schoolId !== session.user.schoolId) {
      return NextResponse.json(
        { error: "Accès non autorisé à cette classe" },
        { status: 403 }
      );
    }

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
    const uniqueStudentIds = [...new Set(records.map((r: { studentId: string }) => r.studentId))];
    const validEnrollmentsCount = await prisma.enrollment.count({
      where: {
        studentId: { in: uniqueStudentIds as string[] },
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
    // Loop over records. Note: upsert requires unique constraint on [studentId, classId, date] which exists in schema
    const results = await prisma.$transaction(
      records.map((record: { studentId: string; status: string; notes?: string }) =>
        prisma.attendance.upsert({
          where: {
            studentId_classId_date: {
              studentId: record.studentId,
              classId,
              date: new Date(date)
            }
          },
          create: {
            studentId: record.studentId,
            classId,
            date: new Date(date),
            status: record.status as any, // Cast to enum
            reason: record.notes, // Map notes to reason
            recordedById: session.user.id,
          },
          update: {
            status: record.status as any,
            reason: record.notes,
            recordedById: session.user.id,
          },
        })
      )
    );

    await syncAnalyticsAfterStudentActivityChange(
      records.map((record: { studentId: string }) => record.studentId),
      new Date(date)
    );
    await Promise.all([
      invalidateByPath("/api/analytics"),
      invalidateByPath("/api/attendance/stats"),
    ]);

    logger.info(`Bulk attendance: ${results.length} records saved by ${session.user.id}`);

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
}

// GET endpoint to fetch bulk attendance data for a class
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

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

    if (session.user.role !== "SUPER_ADMIN" && targetClass.schoolId !== session.user.schoolId) {
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
