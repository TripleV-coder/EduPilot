import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import { invalidateByPath } from "@/lib/api/cache-helpers";
import prisma from "@/lib/prisma";
import { syncAnalyticsAfterStudentActivityChange } from "@/lib/services/analytics-sync";
import type { Prisma } from "@prisma/client";
import { logger } from "@/lib/utils/logger";
import { incidentCreateSchema } from "@/lib/validations/incident";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

/**
 * GET /api/incidents
 * List behavior incidents (filtered by role)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const incidentType = searchParams.get("incidentType");
    const severity = searchParams.get("severity");
    const resolved = searchParams.get("resolved");
    const periodId = searchParams.get("periodId");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: Prisma.BehaviorIncidentWhereInput = {};

    // Non-SUPER_ADMIN must only see incidents from their school
    if (session.user.role !== "SUPER_ADMIN" && getActiveSchoolId(session)) {
      where.student = {
        enrollments: {
          some: {
            class: {
              schoolId: getActiveSchoolId(session),
            },
          },
        },
      };
    }

    // Role-based filtering
    const userRole = session.user.role;

    if (userRole === "STUDENT") {
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
      });
      if (studentProfile) {
        where.studentId = studentProfile.id;
      }
    } else if (userRole === "PARENT") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        include: { parentStudents: true },
      });
      if (parentProfile) {
        where.studentId = { in: parentProfile.parentStudents.map(c => c.studentId) };
      }
    } else if (userRole === "TEACHER") {
      // Teachers can see incidents they reported or for their students
      where.OR = [
        { reportedById: session.user.id },
      ];
    }
    // Admins can see all

    // Additional filters
    if (studentId) where.studentId = studentId;
    if (incidentType && incidentType !== "ALL") where.incidentType = incidentType as Prisma.BehaviorIncidentWhereInput["incidentType"];
    if (severity && severity !== "ALL") where.severity = severity as Prisma.BehaviorIncidentWhereInput["severity"];
    if (resolved !== null && resolved !== "ALL") where.isResolved = resolved === "true";

    if (periodId && periodId !== "ALL") {
      const period = await prisma.period.findUnique({ where: { id: periodId } });
      if (period) {
        where.date = { gte: period.startDate, lte: period.endDate };
      }
    }

    const [incidents, total] = await Promise.all([
      prisma.behaviorIncident.findMany({
        where,
        include: {
          student: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          reportedBy: {
            select: {
              firstName: true,
              lastName: true,
              role: true,
            },
          },
          sanctions: true,
        },
        orderBy: { date: "desc" },
        skip,
        take: limit,
      }),
      prisma.behaviorIncident.count({ where }),
    ]);

    return NextResponse.json({
      incidents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error(" fetching incidents:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des incidents" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/incidents
 * Create behavior incident (Teachers and Admins)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = incidentCreateSchema.parse(body);

    const incident = await prisma.behaviorIncident.create({
      data: {
        studentId: validatedData.studentId,
        reportedById: session.user.id,
        incidentType: validatedData.incidentType,
        severity: validatedData.severity,
        date: new Date(validatedData.date),
        location: validatedData.location,
        description: validatedData.description,
        actionTaken: validatedData.actionTaken,
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            parentStudents: {
              include: {
                parent: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        reportedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Notify parents
    const parentNotifications = incident.student.parentStudents.map(link => ({
      userId: link.parent.user.id,
      type: incident.severity === "CRITICAL" || incident.severity === "HIGH" ? "WARNING" : "INFO",
      title: "Incident de comportement",
      message: `Un incident de type "${validatedData.incidentType}" a été signalé concernant ${incident.student.user.firstName} ${incident.student.user.lastName}`,
      link: `/incidents/${incident.id}`,
    }));

    if (parentNotifications.length > 0) {
      await prisma.notification.createMany({
        data: parentNotifications as any,
      });
    }

    // Notify student (if not critical)
    if (incident.severity !== "CRITICAL") {
      await prisma.notification.create({
        data: {
          userId: incident.student.user.id,
          type: "WARNING",
          title: "Incident signalé",
          message: `Un incident de comportement a été enregistré`,
          link: `/incidents/${incident.id}`,
        },
      });
    }

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE_INCIDENT",
        entity: "BehaviorIncident",
        entityId: incident.id,
        newValues: validatedData,
      },
    });

    await syncAnalyticsAfterStudentActivityChange(
      [incident.studentId],
      incident.date
    );
    await invalidateByPath("/api/analytics");

    return NextResponse.json(incident, { status: 201 });
  } catch (error) {
    if (isZodError(error)) {
      return NextResponse.json(
        {
          error: "Données invalides",
          details: error.issues.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }

    logger.error(" creating incident:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la création de l'incident" },
      { status: 500 }
    );
  }
}
