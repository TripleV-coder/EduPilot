import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { invalidateByPath } from "@/lib/api/cache-helpers";
import { syncAnalyticsAfterStudentActivityChange } from "@/lib/services/analytics-sync";
import { logger } from "@/lib/utils/logger";
import { assertModelAccess } from "@/lib/security/tenant";

/**
 * GET /api/attendance/justifications
 * Returns absences with justification info for a class or student.
 * Uses the existing Attendance model which has justificationDocument field.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const studentId = searchParams.get("studentId");
    const status = searchParams.get("status"); // ABSENT, EXCUSED, etc.

    const where: Prisma.AttendanceWhereInput = {};
    if (classId) where.classId = classId;
    if (studentId) where.studentId = studentId;
    if (status) {
      where.status = status as any;
    } else {
      // Default: only absences (not PRESENT)
      where.status = { in: ["ABSENT", "EXCUSED", "LATE"] };
    }

    if (session.user.role !== "SUPER_ADMIN" && session.user.schoolId) {
      where.student = { schoolId: session.user.schoolId };
    }

    const absences = await prisma.attendance.findMany({
      where,
      include: {
        student: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        class: {
          select: { name: true },
        },
        recordedBy: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: { date: "desc" },
      take: 100,
    });

    const formatted = absences.map((a) => ({
      id: a.id,
      studentId: a.studentId,
      studentName: `${a.student.user.lastName} ${a.student.user.firstName}`,
      className: a.class.name,
      date: a.date,
      status: a.status,
      reason: a.reason,
      hasJustification: !!a.justificationDocument,
      justificationDocument: a.justificationDocument,
      recordedBy: a.recordedBy
        ? `${a.recordedBy.firstName} ${a.recordedBy.lastName}`
        : null,
    }));

    return NextResponse.json({ justifications: formatted, total: formatted.length });
  } catch (error) {
    logger.error("Error fetching justifications", error instanceof Error ? error : new Error(String(error)), { module: "api/attendance/justifications" });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/attendance/justifications
 * Adds a justification document to an existing attendance record.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"].includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const { attendanceId, reason, justificationDocument } = body;

    if (!attendanceId) {
      return NextResponse.json({ error: "attendanceId est requis" }, { status: 400 });
    }
    const guard = await assertModelAccess(session, "attendance", attendanceId, "Absence introuvable");
    if (guard) return guard;

    const currentAttendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
      select: { status: true, studentId: true, date: true }
    });

    if (currentAttendance?.status === "PRESENT") {
      return NextResponse.json({ error: "Impossible de justifier un élève marqué comme présent." }, { status: 400 });
    }

    if (currentAttendance?.status === "EXCUSED" && !["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Cette absence est déjà justifiée." }, { status: 400 });
    }

    // Update the attendance record with justification
    const updated = await prisma.attendance.update({
      where: { id: attendanceId },
      data: {
        status: "EXCUSED",
        reason: reason || undefined,
        justificationDocument: justificationDocument || undefined,
      },
    });

    await syncAnalyticsAfterStudentActivityChange([updated.studentId], updated.date);
    await Promise.all([
      invalidateByPath("/api/analytics"),
      invalidateByPath("/api/attendance/stats"),
    ]);

    return NextResponse.json({ success: true, attendance: updated }, { status: 200 });
  } catch (error) {
    logger.error("Error submitting justification", error instanceof Error ? error : new Error(String(error)), { module: "api/attendance/justifications" });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
