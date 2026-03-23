import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { assertModelAccess } from "@/lib/security/tenant";

/**
 * POST /api/courses/lessons/complete
 * Marks a lesson as completed for the current student.
 * Uses the existing LessonCompletion model.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const { lessonId } = body;

    if (!lessonId) {
      return NextResponse.json({ error: "lessonId est requis" }, { status: 400 });
    }

    // Find the student profile for this user
    const studentProfile = await prisma.studentProfile.findFirst({
      where: { userId: session.user.id },
    });

    if (!studentProfile) {
      return NextResponse.json({ error: "Profil étudiant introuvable" }, { status: 404 });
    }

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      include: {
        module: {
          include: {
            course: {
              include: {
                classSubject: {
                  include: { class: { select: { id: true, schoolId: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Leçon introuvable" }, { status: 404 });
    }

    const lessonAccess = await assertModelAccess(session, "lesson", lessonId, "Leçon introuvable");
    if (lessonAccess) return lessonAccess;

    const courseId = lesson.module.course.id;
    const classId = lesson.module.course.classSubject.class.id;

    const [courseEnrollment, classEnrollment] = await Promise.all([
      prisma.courseEnrollment.findUnique({
        where: {
          courseId_studentId: {
            courseId,
            studentId: studentProfile.id,
          },
        },
      }),
      prisma.enrollment.findFirst({
        where: { studentId: studentProfile.id, classId, status: "ACTIVE" },
      }),
    ]);

    if (!courseEnrollment && !classEnrollment) {
      return NextResponse.json({ error: "Vous devez être inscrit à ce cours" }, { status: 403 });
    }

    // Upsert completion and update enrollment progress in one transaction
    const completion = await prisma.$transaction(async (tx) => {
      const result = await tx.lessonCompletion.upsert({
        where: {
          lessonId_studentId: {
            lessonId,
            studentId: studentProfile.id,
          },
        },
        update: {
          completedAt: new Date(),
        },
        create: {
          lessonId,
          studentId: studentProfile.id,
        },
      });

      // Recalculate and update the progress in CourseEnrollment
      // 1. Get total lessons for this course
      const totalCourseLessons = await tx.lesson.count({
        where: {
          module: {
            courseId: courseId
          }
        }
      });

      // 2. Get completed lessons for this student in this course
      const completedCourseLessons = await tx.lessonCompletion.count({
        where: {
          studentId: studentProfile.id,
          lesson: {
            module: {
              courseId: courseId
            }
          }
        }
      });

      // 3. Update CourseEnrollment
      const progressPercent = totalCourseLessons > 0
        ? Math.round((completedCourseLessons / totalCourseLessons) * 100)
        : 0;

      await tx.courseEnrollment.update({
        where: {
          courseId_studentId: {
            courseId,
            studentId: studentProfile.id,
          },
        },
        data: {
          progress: progressPercent,
          completedAt: progressPercent === 100 ? new Date() : undefined,
        },
      });

      return result;
    });

    return NextResponse.json({ success: true, completion }, { status: 201 });
  } catch (error) {
    logger.error("Error completing lesson", error instanceof Error ? error : new Error(String(error)), { module: "api/courses/lessons/complete" });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
