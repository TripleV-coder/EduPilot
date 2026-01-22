import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac/api-guard";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

const createHomeworkSchema = z.object({
  classSubjectId: z.string().cuid(),
  title: z.string().min(3).max(200),
  description: z.string().min(10),
  dueDate: z.string().datetime(),
  maxGrade: z.number().min(0).max(100).optional(),
  coefficient: z.number().min(0.1).max(10).optional(),
  attachments: z.array(z.string().url()).optional(),
  isPublished: z.boolean().optional(),
});

/**
 * GET /api/homework
 * List homework assignments
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!requireAuth(session)) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const classSubjectId = searchParams.get("classSubjectId");
    const studentId = searchParams.get("studentId");
    const upcoming = searchParams.get("upcoming") === "true";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    interface HomeworkWhereFilter {
      isPublished?: boolean;
      classSubjectId?: string | { in: string[] };
      dueDate?: { gte: Date };
      classSubject?: {
        class?: {
          schoolId?: string;
        };
      };
    }

    const where: HomeworkWhereFilter = { isPublished: true };

    // Non-SUPER_ADMIN must only see homework from their school
    if (session.user.role !== "SUPER_ADMIN" && session.user.schoolId) {
      where.classSubject = {
        class: {
          schoolId: session.user.schoolId,
        },
      };
    }

    // Filter by classSubject
    if (classSubjectId) {
      where.classSubjectId = classSubjectId;
    }

    // Filter upcoming only
    if (upcoming) {
      where.dueDate = { gte: new Date() };
    }

    // Role-based filtering
    const userRole = session.user.role;

    if (userRole === "STUDENT") {
      // Student sees homework for their classes
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
        include: {
          enrollments: {
            where: { status: "ACTIVE" },
            include: {
              class: {
                include: {
                  classSubjects: true,
                },
              },
            },
            take: 1,
          },
        },
      });

      if (studentProfile && studentProfile.enrollments[0]) {
        const classSubjectIds = studentProfile.enrollments[0].class.classSubjects.map(
          (cs) => cs.id
        );
        where.classSubjectId = { in: classSubjectIds };
      }
    } else if (userRole === "PARENT") {
      // Parent sees homework for their children's classes
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        include: { children: true },
      });

      if (parentProfile) {
        const childrenEnrollments = await prisma.enrollment.findMany({
          where: {
            studentId: { in: parentProfile.children.map((c) => c.studentId) },
            status: "ACTIVE",
          },
          include: {
            class: {
              include: {
                classSubjects: true,
              },
            },
          },
        });

        const classSubjectIds = childrenEnrollments.flatMap((e) =>
          e.class.classSubjects.map((cs) => cs.id)
        );
        where.classSubjectId = { in: classSubjectIds };
      }
    } else if (userRole === "TEACHER") {
      // Teacher sees their own homework
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
        include: { classSubjects: true },
      });

      if (teacherProfile) {
        const classSubjectIds = teacherProfile.classSubjects.map((cs) => cs.id);
        where.classSubjectId = { in: classSubjectIds };
      }
    }
    // ADMIN sees all homework in their school

    const [homeworks, total] = await Promise.all([
      prisma.homework.findMany({
        where,
        include: {
          classSubject: {
            include: {
              class: {
                include: {
                  classLevel: true,
                },
              },
              subject: true,
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
            },
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: {
              submissions: true,
            },
          },
        },
        orderBy: { dueDate: "asc" },
        skip,
        take: limit,
      }),
      prisma.homework.count({ where }),
    ]);

    // If student, include their submission status
    let homeworksWithSubmissions = homeworks;
    if (userRole === "STUDENT" && studentId) {
      const submissions = await prisma.homeworkSubmission.findMany({
        where: {
          studentId,
          homeworkId: { in: homeworks.map((h) => h.id) },
        },
        select: {
          homeworkId: true,
          submittedAt: true,
          grade: true,
        },
      });

      const submissionMap = submissions.reduce<Record<string, typeof submissions[0]>>((acc, sub) => {
        acc[sub.homeworkId] = sub;
        return acc;
      }, {});

      homeworksWithSubmissions = homeworks.map((hw) => ({
        ...hw,
        mySubmission: submissionMap[hw.id] || null,
      }));
    }

    return NextResponse.json({
      homeworks: homeworksWithSubmissions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error(" fetching homework:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des devoirs" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/homework
 * Create homework assignment (Teachers only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    // Only teachers and admins can create homework
    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createHomeworkSchema.parse(body);

    // Verify teacher has access to this classSubject
    if (session.user.role === "TEACHER") {
      const classSubject = await prisma.classSubject.findUnique({
        where: { id: validatedData.classSubjectId },
        select: { teacherId: true },
      });

      if (classSubject?.teacherId !== session.user.id) {
        return NextResponse.json(
          { error: "Vous ne pouvez créer des devoirs que pour vos matières" },
          { status: 403 }
        );
      }
    }

    const homework = await prisma.homework.create({
      data: {
        classSubjectId: validatedData.classSubjectId,
        title: validatedData.title,
        description: validatedData.description,
        dueDate: new Date(validatedData.dueDate),
        maxGrade: validatedData.maxGrade,
        coefficient: validatedData.coefficient,
        attachments: validatedData.attachments || [],
        isPublished: validatedData.isPublished ?? true,
        createdById: session.user.id,
      },
      include: {
        classSubject: {
          include: {
            class: {
              include: {
                classLevel: true,
                enrollments: {
                  where: { status: "ACTIVE" },
                  select: { studentId: true },
                },
              },
            },
            subject: true,
          },
        },
      },
    });

    // Create notifications for all students in the class
    if (homework.isPublished) {
      const studentIds = homework.classSubject.class.enrollments.map(
        (e) => e.studentId
      );

      // Get user IDs from student profiles
      const students = await prisma.studentProfile.findMany({
        where: { id: { in: studentIds } },
        select: { userId: true },
      });

      const notifications = students.map((s) => ({
        userId: s.userId,
        type: "INFO" as const,
        title: "Nouveau devoir",
        message: `${homework.classSubject.subject.name}: ${homework.title} - À rendre le ${new Date(homework.dueDate).toLocaleDateString("fr-FR")}`,
        link: `/homework/${homework.id}`,
      }));

      await prisma.notification.createMany({
        data: notifications,
      });
    }

    return NextResponse.json(homework, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
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

    logger.error(" creating homework:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la création du devoir" },
      { status: 500 }
    );
  }
}
