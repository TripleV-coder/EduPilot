import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";

// POST /api/courses/[id]/enroll - Enroll student in course
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "STUDENT") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        enrollments: {
          where: { status: "ACTIVE" },
          include: {
            class: true,
          },
        },
      },
    });

    if (!studentProfile) {
      return NextResponse.json({ error: "Profil étudiant non trouvé" }, { status: 404 });
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
          },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Cours non trouvé" }, { status: 404 });
    }

    if (!course.isPublished) {
      return NextResponse.json({ error: "Cours non disponible" }, { status: 400 });
    }

    // Verify student is enrolled in the class
    const isEnrolledInClass = studentProfile.enrollments.some(
      enrollment => enrollment.classId === course.classSubject.class.id
    );

    if (!isEnrolledInClass) {
      return NextResponse.json({ error: "Vous devez être inscrit à cette classe" }, { status: 403 });
    }

    // Check if already enrolled
    const existingEnrollment = await prisma.courseEnrollment.findUnique({
      where: {
        courseId_studentId: {
          courseId: params.id,
          studentId: studentProfile.id,
        },
      },
    });

    if (existingEnrollment) {
      return NextResponse.json({ error: "Déjà inscrit à ce cours" }, { status: 400 });
    }

    const courseEnrollment = await prisma.courseEnrollment.create({
      data: {
        courseId: params.id,
        studentId: studentProfile.id,
        progress: 0,
      },
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
    });

    // Notify teacher
    if (course.classSubject.teacherId) {
      const teacher = await prisma.teacherProfile.findUnique({
        where: { id: course.classSubject.teacherId },
        include: {
          user: {
            select: { id: true },
          },
        },
      });

      if (teacher) {
        await prisma.notification.create({
          data: {
            userId: teacher.user.id,
            type: "INFO",
            title: "Nouvelle inscription cours",
            message: `${session.user.firstName} ${session.user.lastName} s'est inscrit au cours "${course.title}"`,
            link: `/courses/${params.id}`,
          },
        });
      }
    }

    return NextResponse.json(courseEnrollment, { status: 201 });
  } catch (error) {
    logger.error(" enrolling in course:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

// DELETE /api/courses/[id]/enroll - Unenroll from course
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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

    const enrollment = await prisma.courseEnrollment.findUnique({
      where: {
        courseId_studentId: {
          courseId: params.id,
          studentId: studentProfile.id,
        },
      },
      include: {
        course: true,
      },
    });

    if (!enrollment) {
      return NextResponse.json({ error: "Inscription non trouvée" }, { status: 404 });
    }

    // Don't allow unenrollment if course is completed
    if (enrollment.completedAt) {
      return NextResponse.json({ error: "Impossible de se désinscrire d'un cours terminé" }, { status: 400 });
    }

    await prisma.courseEnrollment.delete({
      where: {
        courseId_studentId: {
          courseId: params.id,
          studentId: studentProfile.id,
        },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(" unenrolling from course:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
