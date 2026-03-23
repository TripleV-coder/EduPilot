import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { assertModelAccess } from "@/lib/security/tenant";

// POST /api/lessons/[id]/complete - Mark lesson as completed
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user || session.user.role !== "STUDENT") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!studentProfile) {
      return NextResponse.json({ error: "Profil étudiant non trouvé" }, { status: 404 });
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id: id },
      include: {
        module: {
          include: {
            course: {
              include: {
                modules: {
                  include: {
                    lessons: true,
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

    const lessonAccess = await assertModelAccess(session, "lesson", id, "Leçon non trouvée");
    if (lessonAccess) return lessonAccess;

    // Verify student is enrolled in course
    const enrollment = await prisma.courseEnrollment.findUnique({
      where: {
        courseId_studentId: {
          courseId: lesson.module.course.id,
          studentId: studentProfile.id,
        },
      },
    });

    if (!enrollment) {
      return NextResponse.json({ error: "Vous devez être inscrit à ce cours" }, { status: 403 });
    }

    // Check if already completed
    const existingCompletion = await prisma.lessonCompletion.findUnique({
      where: {
        lessonId_studentId: {
          lessonId: id,
          studentId: studentProfile.id,
        },
      },
    });

    if (existingCompletion) {
      return NextResponse.json({ error: "Leçon déjà complétée" }, { status: 400 });
    }

    // Mark lesson as completed
    const completion = await prisma.lessonCompletion.create({
      data: {
        lessonId: id,
        studentId: studentProfile.id,
      },
    });

    // Calculate new progress percentage
    const totalLessons = lesson.module.course.modules.reduce(
      (sum, module) => sum + module.lessons.length,
      0
    );

    const completedLessons = await prisma.lessonCompletion.count({
      where: {
        studentId: studentProfile.id,
        lesson: {
          module: {
            courseId: lesson.module.course.id,
          },
        },
      },
    });

    const progress = Math.round((completedLessons / totalLessons) * 100);

    // Update enrollment progress
    await prisma.courseEnrollment.update({
      where: {
        courseId_studentId: {
          courseId: lesson.module.course.id,
          studentId: studentProfile.id,
        },
      },
      data: {
        progress,
        completedAt: progress === 100 ? new Date() : null,
      },
    });

    // If course completed, notify teacher and student
    if (progress === 100 && !enrollment.completedAt) {
      const course = lesson.module.course;

      // Notify student
      await prisma.notification.create({
        data: {
          userId: session.user.id,
          type: "SUCCESS",
          title: "Cours terminé !",
          message: `Félicitations ! Vous avez terminé le cours "${course.title}"`,
          link: `/courses/${course.id}`,
        },
      });

      // Notify teacher
      const classSubject = await prisma.classSubject.findUnique({
        where: { id: course.classSubjectId },
        include: {
          teacher: {
            include: {
              user: {
                select: { id: true },
              },
            },
          },
        },
      });

      if (classSubject?.teacher) {
        await prisma.notification.create({
          data: {
            userId: classSubject.teacher.user.id,
            type: "INFO",
            title: "Cours terminé par un élève",
            message: `${session.user.firstName} ${session.user.lastName} a terminé le cours "${course.title}"`,
            link: `/courses/${course.id}`,
          },
        });
      }

      // Log audit
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "COMPLETE",
          entity: "Course",
          entityId: course.id,
        },
      });
    }

    return NextResponse.json({
      completion,
      progress,
      isCompleted: progress === 100,
    });
  } catch (error) {
    logger.error(" completing lesson:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

// DELETE /api/lessons/[id]/complete - Unmark lesson completion (for teachers/admins)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user || !["TEACHER", "SCHOOL_ADMIN", "DIRECTOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

    if (!studentId) {
      return NextResponse.json({ error: "studentId requis" }, { status: 400 });
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id: id },
      include: {
        module: {
          include: {
            course: {
              include: {
                classSubject: {
                  include: {
                    teacher: true,
                  },
                },
                modules: {
                  include: {
                    lessons: true,
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

    const lessonAccess = await assertModelAccess(session, "lesson", id, "Leçon non trouvée");
    if (lessonAccess) return lessonAccess;

    // Verify ownership if teacher
    if (session.user.role === "TEACHER") {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
      });

      if (!teacherProfile || lesson.module.course.classSubject.teacherId !== teacherProfile.id) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    const completion = await prisma.lessonCompletion.findUnique({
      where: {
        lessonId_studentId: {
          lessonId: id,
          studentId,
        },
      },
    });

    if (!completion) {
      return NextResponse.json({ error: "Complétion non trouvée" }, { status: 404 });
    }

    await prisma.lessonCompletion.delete({
      where: {
        lessonId_studentId: {
          lessonId: id,
          studentId,
        },
      },
    });

    // Recalculate progress
    const totalLessons = lesson.module.course.modules.reduce(
      (sum: number, mod) => sum + mod.lessons.length,
      0
    );

    const completedLessons = await prisma.lessonCompletion.count({
      where: {
        studentId,
        lesson: {
          module: {
            courseId: lesson.module.course.id,
          },
        },
      },
    });

    const progress = Math.round((completedLessons / totalLessons) * 100);

    await prisma.courseEnrollment.update({
      where: {
        courseId_studentId: {
          courseId: lesson.module.course.id,
          studentId,
        },
      },
      data: {
        progress,
        completedAt: null, // Reset completion
      },
    });

    return NextResponse.json({ success: true, progress });
  } catch (error) {
    logger.error(" removing lesson completion:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
