import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { sanitizeRequestBody, sanitizeRichText } from "@/lib/sanitize";
import { getPaginationParams, createPaginatedResponse } from "@/lib/api/api-helpers";

const createCourseSchema = z.object({
  classSubjectId: z.string().cuid(),
  title: z.string().min(3).max(200),
  description: z.string().optional(),
  thumbnail: z.string().url().optional(),
  isPublished: z.boolean().default(false),
  modules: z.array(z.object({
    title: z.string().min(3).max(200),
    description: z.string().optional(),
    order: z.number().int().min(0),
    lessons: z.array(z.object({
      title: z.string().min(3).max(200),
      content: z.string(),
      type: z.enum(["TEXT", "VIDEO", "PDF", "QUIZ", "ASSIGNMENT"]).default("TEXT"),
      videoUrl: z.string().url().optional(),
      fileUrl: z.string().url().optional(),
      duration: z.number().int().min(1).optional(),
      order: z.number().int().min(0),
    })),
  })),
});

// GET /api/courses - List courses
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const classSubjectId = searchParams.get("classSubjectId");
    const isPublished = searchParams.get("isPublished");
    const search = searchParams.get("search");

    const { page, limit, skip } = getPaginationParams(request, { defaultLimit: 20, maxLimit: 50 });

    const where: Prisma.CourseWhereInput = {};

    if (session.user.role === "STUDENT") {
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
        include: { enrollments: { where: { status: "ACTIVE" } } },
      });
      const classIds = studentProfile?.enrollments.map(e => e.classId) || [];
      where.classSubject = { classId: { in: classIds } };
      where.isPublished = true;
    } else if (session.user.role === "PARENT") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        include: { 
          parentStudents: { 
            include: { 
              student: { include: { enrollments: { where: { status: "ACTIVE" } } } } 
            } 
          } 
        },
      });
      const childClassIds: string[] = [];
      parentProfile?.parentStudents.forEach(ps => {
        ps.student.enrollments.forEach(e => childClassIds.push(e.classId));
      });
      where.classSubject = { classId: { in: childClassIds } };
      where.isPublished = true;
    } else if (session.user.role !== "SUPER_ADMIN" && session.user.schoolId) {
      where.classSubject = { class: { schoolId: session.user.schoolId } };
    }

    if (classSubjectId) where.classSubjectId = classSubjectId;
    if (isPublished !== null) where.isPublished = isPublished === "true";
    if (search) where.title = { contains: search, mode: "insensitive" };

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        include: {
          classSubject: {
            include: {
              subject: true,
              class: { include: { classLevel: true } },
            },
          },
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          modules: {
            orderBy: { order: "asc" },
            include: {
              lessons: {
                orderBy: { order: "asc" },
                select: { id: true, title: true, type: true, duration: true, order: true },
              },
            },
          },
          _count: {
            select: { enrollments: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.course.count({ where }),
    ]);

    return createPaginatedResponse(courses, total, { page, limit, skip });
  } catch (error) {
    logger.error("Error fetching courses", error as Error);
    return NextResponse.json({ error: "Erreur lors de la récupération des cours", code: "FETCH_ERROR" }, { status: 500 });
  }
}

// POST /api/courses - Create course with modules and lessons
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !["TEACHER", "SCHOOL_ADMIN", "DIRECTOR", "SUPER_ADMIN"].includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé", code: "FORBIDDEN" }, { status: 403 });
    }

    const body = await request.json();
    const sanitizedBody = sanitizeRequestBody(body);
    const validatedData = createCourseSchema.parse(sanitizedBody);

    // Verify class subject belongs to school
    const classSubject = await prisma.classSubject.findFirst({
      where: {
        id: validatedData.classSubjectId,
      },
      include: {
        subject: true,
        class: true,
      },
    });

    if (!classSubject) {
      return NextResponse.json({ error: "Matière non trouvée", code: "NOT_FOUND" }, { status: 404 });
    }

    // If teacher, verify assignment
    if (session.user.role === "TEACHER") {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
      });

      if (!teacherProfile) {
        return NextResponse.json({ error: "Profil enseignant non trouvé", code: "NOT_FOUND" }, { status: 404 });
      }

      const isAssigned = await prisma.classSubject.findFirst({
        where: {
          id: validatedData.classSubjectId,
          teacherId: teacherProfile.id,
        },
      });

      if (!isAssigned) {
        return NextResponse.json({ error: "Vous n'êtes pas affecté à cette matière", code: "FORBIDDEN" }, { status: 403 });
      }
    }

    // Create course with nested modules and lessons using transaction
    const course = await prisma.$transaction(async (tx) => {
      // Create course
      const newCourse = await tx.course.create({
        data: {
          classSubjectId: validatedData.classSubjectId,
          title: validatedData.title,
          description: validatedData.description ? sanitizeRichText(validatedData.description) : undefined,
          thumbnail: validatedData.thumbnail,
          isPublished: validatedData.isPublished,
          createdById: session.user.id,
          modules: {
            create: validatedData.modules.map(module => ({
              title: module.title,
              description: module.description,
              order: module.order,
              lessons: {
                create: module.lessons.map(lesson => ({
                  title: lesson.title,
                  content: sanitizeRichText(lesson.content),
                  type: lesson.type,
                  videoUrl: lesson.videoUrl,
                  fileUrl: lesson.fileUrl,
                  duration: lesson.duration,
                  order: lesson.order,
                })),
              },
            })),
          },
        },
        include: {
          modules: {
            include: {
              lessons: true,
            },
          },
          classSubject: {
            include: {
              subject: true,
              class: { include: { classLevel: true } },
            },
          },
        },
      });

      // Create audit log inside transaction
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entity: "Course",
          entityId: newCourse.id,
          newValues: { title: newCourse.title },
        },
      });

      return newCourse;
    });

    // Notify students if published (outside transaction for performance)
    if (validatedData.isPublished) {
      const enrollments = await prisma.enrollment.findMany({
        where: {
          classId: classSubject.classId,
          status: "ACTIVE",
        },
        include: {
          student: {
            include: {
              user: {
                select: { id: true },
              },
            },
          },
        },
        take: 1000, // Limit notifications
      });

      if (enrollments.length > 0) {
        await prisma.notification.createMany({
          data: enrollments.map(enrollment => ({
            userId: enrollment.student.user.id,
            type: "INFO",
            title: "Nouveau cours disponible",
            message: `Le cours "${course.title}" est maintenant disponible`,
            link: `/courses/${course.id}`,
          })),
          skipDuplicates: true,
        });
      }
    }

    logger.info("Course created", { courseId: course.id, createdBy: session.user.id });
    return NextResponse.json(course, { status: 201 });
  } catch (error) {
    if (isZodError(error)) {
      return NextResponse.json(
        {
          error: "Données invalides",
          code: "VALIDATION_ERROR",
          details: error.issues.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }
    logger.error("Error creating course", error as Error);
    return NextResponse.json({ error: "Erreur lors de la création du cours", code: "CREATE_ERROR" }, { status: 500 });
  }
}
