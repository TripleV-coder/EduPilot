import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ensureRequestedSchoolAccess } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";

/**
 * API Endpoint for absence alerts management
 */

/**
 * GET - Fetch absence alerts
 */
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get("schoolId");
    const classId = searchParams.get("classId");
    const daysBack = parseInt(searchParams.get("daysBack") || "7");
    const schoolAccess = ensureRequestedSchoolAccess(session, schoolId);
    if (schoolAccess) return schoolAccess;

    if (!schoolId) {
      return NextResponse.json(
        { error: "ID d'établissement requis" },
        { status: 400 }
      );
    }

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Build where clause
    const where: {
      student: { schoolId: string };
      status: "ABSENT";
      date: { gte: Date };
      classId?: string;
    } = {
      student: { schoolId },
      status: "ABSENT",
      date: { gte: startDate },
    };

    if (classId && classId !== "all") {
      where.classId = classId;
    }

    // Fetch absent records
    const absentRecords = await prisma.attendance.findMany({
      where,
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true, phone: true } },
          },
        },
        class: {
          include: {
            classLevel: { select: { name: true } },
          },
        },
      },
      orderBy: { date: "desc" },
      take: 100,
    });

    // Count absences per student
    const studentAbsenceCounts = absentRecords.reduce((acc, record) => {
      acc[record.studentId] = (acc[record.studentId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Transform into alerts
    const alerts = absentRecords.map((record) => {
      return {
        id: `alert-${record.id}`,
        studentId: record.studentId,
        studentName: `${record.student.user.firstName} ${record.student.user.lastName}`,
        matricule: record.student.matricule,
        parentContact: record.student.user.phone || record.student.user.email || "N/A",
        className: `${record.class.classLevel.name} ${record.class.name}`,
        date: record.date.toISOString(),
        status: "PENDING" as const,
        absenceCount: studentAbsenceCounts[record.studentId] || 1,
        reason: record.reason || undefined,
      };
    });

    // Group by student and return only the most recent alert per student
    const uniqueAlerts = Object.values(
      alerts.reduce((acc, alert) => {
        if (!acc[alert.studentId] || new Date(alert.date) > new Date(acc[alert.studentId].date)) {
          acc[alert.studentId] = alert;
        }
        return acc;
      }, {} as Record<string, typeof alerts[0]>)
    );

    return NextResponse.json(uniqueAlerts);
  } catch (error) {
    logger.error("Fetch alerts error:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des alertes" },
      { status: 500 }
    );
  }
}
