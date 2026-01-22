import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

const updateCourseSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().optional(),
  thumbnail: z.string().url().optional(),
  isPublished: z.boolean().optional(),
});

// GET /api/courses/[id] - Get course details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const course = await prisma.course.findUnique({
      where: { id: params.id },
      include: {
        classSubject: {
          include: {
            subject: true,
            class: {
              include: {
                classLevel: true,
              },
            },
            teacher: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
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
        modules: {
          orderBy: { order: "asc" },
          include: {
            lessons: {
              orderBy: { order: "asc" },
            },
          },
        },
        enrollments: {
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
              },
            },
          },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Cours non trouvé" }, { status: 404 });
    }

    // Verify access
    if (course.classSubject.subject.schoolId !== session.user.schoolId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Students can only see published courses
    if (session.user.role === "STUDENT" && !course.isPublished) {
      return NextResponse.json({ error: "Cours non disponible" }, { status: 404 });
    }

    // If student, include their progress
    if (session.user.role === "STUDENT") {
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
      });

      if (studentProfile) {
        const enrollment = await prisma.courseEnrollment.findUnique({
          where: {
            courseId_studentId: {
              courseId: params.id,
              studentId: studentProfile.id,
            },
          },
        });

        // Get completed lessons for this course
        const completedLessons = await prisma.lessonCompletion.findMany({
          where: {
            studentId: studentProfile.id,
            lesson: {
              module: {
                courseId: params.id,
              },
            },
          },
        });

        return NextResponse.json({
          ...course,
          enrollment,
          completedLessons,
        });
      }
    }

    return NextResponse.json(course);
  } catch (error) {
    logger.error(" fetching course:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

// PATCH /api/courses/[id] - Update course
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user || !["TEACHER", "SCHOOL_ADMIN", "DIRECTOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = updateCourseSchema.parse(body);

    const course = await prisma.course.findUnique({
      where: { id: params.id },
      include: {
        classSubject: {
          include: {
            subject: true,
            teacher: true,
          },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Cours non trouvé" }, { status: 404 });
    }

    // Verify ownership/assignment
    if (session.user.role === "TEACHER") {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
      });

      if (!teacherProfile || course.classSubject.teacherId !== teacherProfile.id) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    const wasPublished = course.isPublished;

    const updatedCourse = await prisma.course.update({
      where: { id: params.id },
      data: validatedData,
      include: {
        modules: {
          include: {
            lessons: true,
          },
        },
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entity: "Course",
        entityId: params.id,
      },
    });

    // Notify enrolled students if just published
    if (!wasPublished && validatedData.isPublished) {
      const enrollments = await prisma.enrollment.findMany({
        where: {
          classId: course.classSubject.classId,
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
      });

      await prisma.notification.createMany({
        data: enrollments.map(enrollment => ({
          userId: enrollment.student.user.id,
          type: "INFO",
          title: "Nouveau cours disponible",
          message: `Le cours "${updatedCourse.title}" est maintenant disponible`,
          link: `/courses/${params.id}`,
        })),
      });
    }

    return NextResponse.json(updatedCourse);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
    }
    logger.error(" updating course:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

// DELETE /api/courses/[id] - Delete course
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user || !["TEACHER", "SCHOOL_ADMIN", "DIRECTOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const course = await prisma.course.findUnique({
      where: { id: params.id },
      include: {
        classSubject: {
          include: {
            subject: true,
            teacher: true,
          },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Cours non trouvé" }, { status: 404 });
    }

    // Verify ownership
    if (session.user.role === "TEACHER") {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
      });

      if (!teacherProfile || course.classSubject.teacherId !== teacherProfile.id) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    await prisma.course.delete({
      where: { id: params.id },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE",
        entity: "Course",
        entityId: params.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(" deleting course:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
