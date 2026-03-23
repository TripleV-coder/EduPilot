import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { logger } from "@/lib/utils/logger";
import { CACHE_TTL_SHORT, generateCacheKey, withCache } from "@/lib/api/cache-helpers";
import { withHttpCache } from "@/lib/api/cache-http";

// GET /api/incidents/statistics - Get incident statistics
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const url = new URL(request.url);
    const { searchParams } = url;
    const classId = searchParams.get("classId");
    const studentId = searchParams.get("studentId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const period = searchParams.get("period"); // "week", "month", "year"

    const cacheKey = generateCacheKey(url.pathname, url.searchParams, session.user.id);
    const handler = async () => {
    // Build date filter
    const dateFilter: Prisma.DateTimeFilter = {};
    const now = new Date();

    if (period === "week") {
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);
      dateFilter.gte = weekStart;
    } else if (period === "month") {
      const monthStart = new Date(now);
      monthStart.setMonth(now.getMonth() - 1);
      dateFilter.gte = monthStart;
    } else if (startDate) {
      dateFilter.gte = new Date(startDate);
    }

    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }

    // Build where clause
    const where: Prisma.BehaviorIncidentWhereInput = {
      date: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
    };

    // Build initial student filter
    let studentFilter: Prisma.StudentProfileWhereInput | undefined = undefined;

    // Role-based filtering
    if (session.user.role === "STUDENT") {
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
      });
      if (studentProfile) {
        where.studentId = studentProfile.id;
      } else {
        return NextResponse.json({ error: "Élève non trouvé" }, { status: 404 });
      }
    } else if (session.user.role === "PARENT") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        include: { parentStudents: true },
      });
      if (parentProfile) {
        const childIds = parentProfile.parentStudents.map(c => c.studentId);
        where.studentId = { in: childIds };
      } else {
        return NextResponse.json({ error: "Parent non trouvé" }, { status: 404 });
      }
    } else if (session.user.role !== "SUPER_ADMIN" && session.user.schoolId) {
      // School filter for other staff
      studentFilter = {
        enrollments: {
          some: {
            class: {
              schoolId: session.user.schoolId,
            },
          },
        },
      };
    }

    // Class filter (can be combined with other filters)
    if (classId) {
      if (studentFilter) {
        // Merge with existing enrollment filter
        studentFilter = {
          ...studentFilter,
          enrollments: {
            some: {
              ...(studentFilter.enrollments as Prisma.EnrollmentListRelationFilter).some,
              classId,
              status: "ACTIVE",
            },
          },
        };
      } else {
        studentFilter = {
          enrollments: {
            some: {
              classId,
              status: "ACTIVE",
            },
          },
        };
      }
    }

    if (studentFilter) {
      where.student = studentFilter;
    }

    // Student filter
    if (studentId) {
      where.studentId = studentId;
    }

    // Get all incidents matching filters
    const incidents = await prisma.behaviorIncident.findMany({
      where,
      include: {
        student: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
            enrollments: {
              where: { status: "ACTIVE" },
              include: {
                class: {
                  select: { name: true },
                },
              },
            },
          },
        },
        sanctions: true,
      },
    });

    // Calculate statistics
    const stats = {
      totalIncidents: incidents.length,
      bySeverity: {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        CRITICAL: 0,
      },
      byType: {} as Record<string, number>,
      byStatus: {
        pending: 0,
        in_progress: 0,
        resolved: 0,
        escalated: 0,
      },
      resolvedCount: 0,
      unresolvedCount: 0,
      parentNotifiedCount: 0,
      averageResolutionTime: 0, // in hours
    };

    // Calculate resolution time
    const resolutionTimes: number[] = [];

    incidents.forEach((incident) => {
      // By severity
      stats.bySeverity[incident.severity as keyof typeof stats.bySeverity]++;

      // By type
      stats.byType[incident.incidentType] = (stats.byType[incident.incidentType] || 0) + 1;

      // By status
      if (incident.isResolved) {
        stats.byStatus.resolved++;
        stats.resolvedCount++;

        // Calculate resolution time
        const created = new Date(incident.createdAt).getTime();
        const resolved = new Date(incident.updatedAt).getTime();
        const hours = (resolved - created) / (1000 * 60 * 60);
        resolutionTimes.push(hours);
      } else {
        stats.byStatus.pending++;
        stats.unresolvedCount++;
      }

      if (incident.severity === "HIGH" || incident.severity === "CRITICAL") {
        if (incident.severity === "CRITICAL") {
          stats.byStatus.escalated++;
        }
      }

      // Parent notification - inferred from sanctions
      const hasParentConference = incident.sanctions.some(s => s.type === "PARENT_CONFERENCE");
      if (hasParentConference) {
        stats.parentNotifiedCount++;
      }
    });

    // Calculate average resolution time
    if (resolutionTimes.length > 0) {
      stats.averageResolutionTime =
        resolutionTimes.reduce((sum, t) => sum + t, 0) / resolutionTimes.length;
    }

    // Top incidents by type
    const topIncidentTypes = Object.entries(stats.byType)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    // Most affected students
    const studentIncidentCount: Record<string, { name: string; count: number; className: string }> = {};
    incidents.forEach((incident) => {
      const key = incident.studentId;
      if (!studentIncidentCount[key]) {
        const enrollment = incident.student.enrollments[0];
        studentIncidentCount[key] = {
          name: `${incident.student.user.firstName} ${incident.student.user.lastName}`,
          count: 0,
          className: enrollment?.class.name || "N/A",
        };
      }
      studentIncidentCount[key].count++;
    });

    const topStudents = Object.values(studentIncidentCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Critical incidents (recent)
    const criticalIncidents = incidents
      .filter((i) => i.severity === "CRITICAL" && !i.isResolved)
      .slice(0, 5);

    // Trends (compare with previous period)
    let trend: "up" | "down" | "stable" = "stable";
    const previousPeriodStart = new Date(now);
    const previousPeriodEnd = new Date(now);

    if (period === "week") {
      previousPeriodStart.setDate(now.getDate() - 14);
      previousPeriodEnd.setDate(now.getDate() - 7);
    } else if (period === "month") {
      previousPeriodStart.setMonth(now.getMonth() - 2);
      previousPeriodEnd.setMonth(now.getMonth() - 1);
    }

    const previousIncidents = await prisma.behaviorIncident.count({
      where: {
        ...where,
        date: {
          gte: previousPeriodStart,
          lte: previousPeriodEnd,
        },
      },
    });

    if (incidents.length > previousIncidents * 1.1) {
      trend = "up";
    } else if (incidents.length < previousIncidents * 0.9) {
      trend = "down";
    }

    // Daily trend for charts
    const dailyTrend = incidents.reduce((acc, incident) => {
      const date = format(new Date(incident.date), "yyyy-MM-dd");
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      statistics: stats,
      trend,
      topIncidentTypes,
      topStudents,
      criticalIncidents: criticalIncidents.map((i) => ({
        id: i.id,
        title: i.incidentType,
        severity: i.severity,
        date: i.date,
        studentName: `${i.student.user.firstName} ${i.student.user.lastName}`,
      })),
      dailyTrend,
      period: {
        current: { start: dateFilter.gte, end: dateFilter.lte },
        previous: { start: previousPeriodStart, end: previousPeriodEnd },
      },
    });
    };

    const response = await withCache(handler as any, { ttl: CACHE_TTL_SHORT, key: cacheKey });
    return withHttpCache(response, request, { private: true, maxAge: CACHE_TTL_SHORT, staleWhileRevalidate: 15 });
  } catch (error) {
    logger.error("Error fetching incident statistics", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des statistiques" },
      { status: 500 }
    );
  }
}

function format(date: Date, _formatStr: string): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
