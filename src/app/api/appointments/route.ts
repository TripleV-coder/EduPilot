import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { ensureSchoolAccess } from "@/lib/api/tenant-isolation";

const createAppointmentSchema = z.object({
  teacherId: z.string().cuid(),
  parentId: z.string().cuid(),
  studentId: z.string().cuid(),
  scheduledAt: z.string().datetime(),
  duration: z.number().min(15).max(120).default(30),
  type: z.enum(["IN_PERSON", "VIDEO_CALL", "PHONE_CALL"]).default("IN_PERSON"),
  location: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * GET /api/appointments
 * List appointments (filtered by role)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const teacherId = searchParams.get("teacherId");
    const parentId = searchParams.get("parentId");
    const studentId = searchParams.get("studentId");
    const upcoming = searchParams.get("upcoming") === "true";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: any = {};

    // Role-based filtering
    const userRole = session.user.role;

    // Protection Multi-Tenant pour les admins
    if (userRole !== "SUPER_ADMIN" && session.user.schoolId) {
      // Filtrer par les professeurs de l'école (relation indirecte via teacher.user)
      if (where.teacher) {
        where.teacher.user = { schoolId: session.user.schoolId };
      } else {
        where.teacher = { user: { schoolId: session.user.schoolId } };
      }
    }

    if (userRole === "TEACHER") {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
      });
      if (teacherProfile) {
        where.teacherId = teacherProfile.id;
      }
    } else if (userRole === "PARENT") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
      });
      if (parentProfile) {
        where.parentId = parentProfile.id;
      }
    } else if (userRole === "STUDENT") {
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
      });
      if (studentProfile) {
        where.studentId = studentProfile.id;
      }
    }
    // Admins can see all (filtered by school above)

    // Additional filters
    if (status) where.status = status;
    if (teacherId) where.teacherId = teacherId;
    if (parentId) where.parentId = parentId;
    if (studentId) where.studentId = studentId;

    if (upcoming) {
      where.scheduledAt = { gte: new Date() };
      where.status = { in: ["PENDING", "CONFIRMED"] };
    }

    const [appointments, total] = await Promise.all([
      prisma.appointment.findMany({
        where,
        include: {
          teacher: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          parent: {
            include: {
              user: {
                select: {
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
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
        },
        orderBy: { scheduledAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.appointment.count({ where }),
    ]);

    return NextResponse.json({
      appointments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error(" fetching appointments:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des rendez-vous" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/appointments
 * Create appointment (Parents and Admins)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createAppointmentSchema.parse(body);

    // Verify teacher exists and school check
    const teacher = await prisma.teacherProfile.findUnique({
      where: { id: validatedData.teacherId },
      include: { user: { select: { schoolId: true } } },
    });

    if (!teacher) {
      return NextResponse.json({ error: "Enseignant non trouvé" }, { status: 404 });
    }

    const accessError = ensureSchoolAccess(session, teacher.user.schoolId);
    if (accessError) {
      return accessError;
    }

    // Verify parent has access to student
    const parentStudent = await prisma.parentStudent.findFirst({
      where: {
        parentId: validatedData.parentId,
        studentId: validatedData.studentId,
      },
    });

    if (!parentStudent) {
      return NextResponse.json(
        { error: "Ce parent n'est pas lié à cet élève" },
        { status: 400 }
      );
    }

    // Check if teacher is available at this time
    const scheduledDate = new Date(validatedData.scheduledAt);
    // const dayOfWeek = scheduledDate.getDay();
    // const timeString = scheduledDate.toTimeString().slice(0, 5);

    // Check for conflicting appointments
    const conflictingAppointment = await prisma.appointment.findFirst({
      where: {
        teacherId: validatedData.teacherId,
        scheduledAt: {
          gte: scheduledDate,
          lt: new Date(scheduledDate.getTime() + validatedData.duration * 60000),
        },
        status: {
          in: ["PENDING", "CONFIRMED"],
        },
      },
    });

    if (conflictingAppointment) {
      return NextResponse.json(
        { error: "L'enseignant a déjà un rendez-vous à ce créneau" },
        { status: 400 }
      );
    }

    // Generate meeting link if VIDEO_CALL
    const meetingLink = validatedData.type === "VIDEO_CALL"
      ? `https://meet.edupilot.app/${Math.random().toString(36).substring(7)}`
      : undefined;

    const appointment = await prisma.appointment.create({
      data: {
        teacherId: validatedData.teacherId,
        parentId: validatedData.parentId,
        studentId: validatedData.studentId,
        scheduledAt: scheduledDate,
        duration: validatedData.duration,
        type: validatedData.type,
        location: validatedData.location,
        notes: validatedData.notes,
        meetingLink,
        createdById: session.user.id,
      },
      include: {
        teacher: {
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
      },
    });

    // Create notifications
    await Promise.all([
      // Notify teacher
      prisma.notification.create({
        data: {
          userId: appointment.teacher.user.id,
          type: "INFO",
          title: "Nouveau rendez-vous",
          message: `${appointment.parent.user.firstName} ${appointment.parent.user.lastName} souhaite un rendez-vous concernant ${appointment.student.user.firstName} ${appointment.student.user.lastName}`,
          link: `/appointments/${appointment.id}`,
        },
      }),
      // Notify parent
      prisma.notification.create({
        data: {
          userId: appointment.parent.user.id,
          type: "SUCCESS",
          title: "Rendez-vous demandé",
          message: `Votre demande de rendez-vous avec ${appointment.teacher.user.firstName} ${appointment.teacher.user.lastName} a été envoyée`,
          link: `/appointments/${appointment.id}`,
        },
      }),
    ]);

    return NextResponse.json(appointment, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { status: 400 }
      );
    }

    logger.error(" creating appointment:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la création du rendez-vous" },
      { status: 500 }
    );
  }
}
