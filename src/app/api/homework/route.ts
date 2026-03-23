import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac/api-guard";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
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
 * @swagger
 * /api/homework:
 *   get:
 *     summary: Liste des devoirs
 *     description: Récupère la liste paginée des devoirs avec filtres optionnels
 *     tags: [Homework]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: classSubjectId
 *         in: query
 *         schema:
 *           type: string
 *         description: Filtrer par matière de classe
 *       - name: studentId
 *         in: query
 *         schema:
 *           type: string
 *         description: Filtrer par élève (pour voir ses devoirs)
 *       - name: upcoming
 *         in: query
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Filtrer uniquement les devoirs à venir
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Liste des devoirs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 homeworks:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!requireAuth(session)) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const searchParams = request.nextUrl?.searchParams ?? new URL(request.url).searchParams;
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
        include: { parentStudents: true },
      });

      if (parentProfile) {
        const childrenEnrollments = await prisma.enrollment.findMany({
          where: {
            studentId: { in: parentProfile.parentStudents.map((c) => c.studentId) },
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

    // Optimize: Include submissions in the main query to avoid N+1
    const includeSubmissions = userRole === "STUDENT" && studentId;

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
          // Include submissions directly to avoid N+1 query
          ...(includeSubmissions && {
            submissions: {
              where: {
                studentId,
              },
              select: {
                id: true,
                submittedAt: true,
                grade: true,
              },
              take: 1, // Only need one submission per homework
            },
          }),
        },
        orderBy: { dueDate: "asc" },
        skip,
        take: limit,
      }),
      prisma.homework.count({ where }),
    ]);

    // Map submissions if included (response shape: mySubmission + omit submissions from payload)
    let homeworksWithSubmissions = homeworks;
    if (includeSubmissions) {
      homeworksWithSubmissions = homeworks.map((hw) => {
        const { submissions, ...rest } = hw;
        const mySubmission = submissions && submissions.length > 0 ? submissions[0] : null;
        return { ...rest, mySubmission };
      }) as unknown as typeof homeworks;
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

    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Only teachers and admins can create homework
    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createHomeworkSchema.parse(body);

    // Verify teacher has access to this classSubject
    if (session.user.role === "TEACHER") {
      const [classSubject, teacherProfile] = await Promise.all([
        prisma.classSubject.findUnique({
          where: { id: validatedData.classSubjectId },
          select: { teacherId: true },
        }),
        prisma.teacherProfile.findUnique({
          where: { userId: session.user.id },
          select: { id: true },
        }),
      ]);

      if (!teacherProfile || classSubject?.teacherId !== teacherProfile.id) {
        return NextResponse.json(
          { error: "Vous ne pouvez créer des devoirs que pour vos matières" },
          { status: 403 }
        );
      }
    } else if (session.user.role !== "SUPER_ADMIN") {
      // SCHOOL_ADMIN or DIRECTOR: Ensure classSubject belongs to their school
      const classSubject = await prisma.classSubject.findUnique({
        where: { id: validatedData.classSubjectId },
        include: { class: { select: { schoolId: true } } }
      });

      if (!classSubject || classSubject.class.schoolId !== session.user.schoolId) {
        return NextResponse.json(
          { error: "Accès refusé: Cette matière n'appartient pas à votre établissement" },
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

    await invalidateByPath(CACHE_PATHS.homework);

    return NextResponse.json(homework, { status: 201 });
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

    logger.error(" creating homework:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la création du devoir" },
      { status: 500 }
    );
  }
}
