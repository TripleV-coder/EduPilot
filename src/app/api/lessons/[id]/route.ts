import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

const updateLessonSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  content: z.string().optional(),
  type: z.enum(["TEXT", "VIDEO", "PDF", "QUIZ", "ASSIGNMENT"]).optional(),
  videoUrl: z.string().url().optional().nullable(),
  fileUrl: z.string().url().optional().nullable(),
  duration: z.number().int().min(1).optional().nullable(),
  order: z.number().int().min(0).optional(),
});

// GET /api/lessons/[id] - Get lesson details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id: params.id },
      include: {
        module: {
          include: {
            course: {
              include: {
                classSubject: {
                  include: {
                    subject: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Leçon non trouvée" }, { status: 404 });
    }

    // Verify access
    if (lesson.module.course.classSubject.subject.schoolId !== session.user.schoolId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Students only see published courses
    if (session.user.role === "STUDENT" && !lesson.module.course.isPublished) {
      return NextResponse.json({ error: "Leçon non disponible" }, { status: 404 });
    }

    // If student, include completion status
    if (session.user.role === "STUDENT") {
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
      });

      if (studentProfile) {
        const completion = await prisma.lessonCompletion.findUnique({
          where: {
            lessonId_studentId: {
              lessonId: params.id,
              studentId: studentProfile.id,
            },
          },
        });

        return NextResponse.json({
          ...lesson,
          isCompleted: !!completion,
          completedAt: completion?.completedAt,
        });
      }
    }

    return NextResponse.json(lesson);
  } catch (error) {
    logger.error(" fetching lesson:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

// PATCH /api/lessons/[id] - Update lesson
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
    const validatedData = updateLessonSchema.parse(body);

    const lesson = await prisma.lesson.findUnique({
      where: { id: params.id },
      include: {
        module: {
          include: {
            course: {
              include: {
                classSubject: {
                  include: {
                    subject: true,
                    teacher: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Leçon non trouvée" }, { status: 404 });
    }

    // Verify ownership if teacher
    if (session.user.role === "TEACHER") {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
      });

      if (!teacherProfile || lesson.module.course.classSubject.teacherId !== teacherProfile.id) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    const updatedLesson = await prisma.lesson.update({
      where: { id: params.id },
      data: validatedData,
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entity: "Lesson",
        entityId: params.id,
      },
    });

    return NextResponse.json(updatedLesson);
  } catch (error) {
    if (error instanceof z.ZodError) {
    }
    logger.error(" updating lesson:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

// DELETE /api/lessons/[id] - Delete lesson
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user || !["TEACHER", "SCHOOL_ADMIN", "DIRECTOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id: params.id },
      include: {
        module: {
          include: {
            course: {
              include: {
                classSubject: {
                  include: {
                    subject: true,
                    teacher: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Leçon non trouvée" }, { status: 404 });
    }

    // Verify ownership if teacher
    if (session.user.role === "TEACHER") {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
      });

      if (!teacherProfile || lesson.module.course.classSubject.teacherId !== teacherProfile.id) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    await prisma.lesson.delete({
      where: { id: params.id },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE",
        entity: "Lesson",
        entityId: params.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(" deleting lesson:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
