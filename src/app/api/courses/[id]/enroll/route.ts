import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { Permission } from "@/lib/rbac/permissions";

// POST /api/courses/[id]/enroll - Enroll student in course
export const POST = createApiHandler(
  async (request: NextRequest, { session, params }) => {
    const { id } = await params;

    if (session.user.role !== "STUDENT") {
      return NextResponse.json({ error: "Seuls les étudiants peuvent s'inscrire à un cours" }, { status: 403 });
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
      where: { id: id },
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

    if (course.classSubject.class.schoolId !== studentProfile.schoolId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Verify student is enrolled in the class
    const isEnrolledInClass = studentProfile.enrollments.some(
      enrollment => enrollment.classId === course.classSubject.class.id
    );

    if (!isEnrolledInClass) {
      return NextResponse.json({ error: "Vous devez être inscrit à cette classe" }, { status: 403 });
    }

    try {
      const courseEnrollment = await prisma.courseEnrollment.create({
        data: {
          courseId: id,
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

      return NextResponse.json(courseEnrollment, { status: 201 });
    } catch (dbError) {
      if (
        dbError instanceof Prisma.PrismaClientKnownRequestError &&
        dbError.code === "P2002"
      ) {
        return NextResponse.json({ error: "Déjà inscrit à ce cours" }, { status: 400 });
      }
      throw dbError;
    }
  },
  { requireAuth: true, requiredPermissions: [Permission.STUDENT_READ_OWN] }
);

// DELETE /api/courses/[id]/enroll - Unenroll from course
export const DELETE = createApiHandler(
  async (request: NextRequest, { session, params }) => {
    const { id } = await params;

    if (session.user.role !== "STUDENT") {
      return NextResponse.json({ error: "Seuls les étudiants peuvent se désinscrire d'un cours" }, { status: 403 });
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
          courseId: id,
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
          courseId: id,
          studentId: studentProfile.id,
        },
      },
    });

    return NextResponse.json({ success: true });
  },
  { requireAuth: true, requiredPermissions: [Permission.STUDENT_READ_OWN] }
);
