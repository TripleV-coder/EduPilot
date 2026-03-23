import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";

/**
 * GET /api/courses/progress
 * Returns the progress for a student across all enrolled courses.
 * Uses the existing CourseEnrollment and LessonCompletion models.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    if (session.user.role !== "STUDENT") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("courseId");

    // Find student profile
    const studentProfile = await prisma.studentProfile.findFirst({
      where: { userId: session.user.id },
    });

    if (!studentProfile) {
      return NextResponse.json({ error: "Profil étudiant introuvable" }, { status: 404 });
    }

    // Build where clause for course enrollments
    const where: Prisma.CourseEnrollmentWhereInput = { studentId: studentProfile.id };
    if (courseId) where.courseId = courseId;

    // Fetch enrollments with course details
    const enrollments = await prisma.courseEnrollment.findMany({
      where,
      include: {
        course: {
          include: {
            modules: {
              include: {
                lessons: {
                  select: { id: true },
                },
              },
            },
          },
        },
      },
    });

    // Gather all lesson IDs across all enrollments
    const allLessonIds = enrollments.flatMap((enrollment) =>
      enrollment.course.modules.flatMap((mod) => mod.lessons.map((l) => l.id))
    );

    // Single batch query: count completions grouped by lessonId
    const completions = await prisma.lessonCompletion.findMany({
      where: {
        studentId: studentProfile.id,
        lessonId: { in: allLessonIds },
      },
      select: { lessonId: true },
    });
    const completedLessonIds = new Set(completions.map((c) => c.lessonId));

    // Build progress from in-memory data
    const progress = enrollments.map((enrollment) => {
      const totalLessons = enrollment.course.modules.reduce(
        (sum, mod) => sum + mod.lessons.length,
        0
      );

      const lessonIds = enrollment.course.modules.flatMap(
        (mod) => mod.lessons.map((l) => l.id)
      );
      const completedCount = lessonIds.filter((id) => completedLessonIds.has(id)).length;

      const progressPercent = totalLessons > 0
        ? Math.round((completedCount / totalLessons) * 100)
        : 0;

      return {
        courseId: enrollment.courseId,
        courseTitle: enrollment.course.title,
        totalLessons,
        completedLessons: completedCount,
        progress: progressPercent,
        completedAt: enrollment.completedAt,
      };
    });

    return NextResponse.json({ progress });
  } catch (error) {
    logger.error("Error fetching course progress", error instanceof Error ? error : new Error(String(error)), { module: "api/courses/progress" });
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
