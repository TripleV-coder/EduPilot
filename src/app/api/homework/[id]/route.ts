import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

const updateHomeworkSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().min(10).optional(),
  dueDate: z.string().datetime().optional(),
  maxGrade: z.number().min(0).max(100).optional(),
  coefficient: z.number().min(0.1).max(10).optional(),
  isPublished: z.boolean().optional(),
});

/**
 * GET /api/homework/[id]
 * Get homework details with submissions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const homework = await prisma.homework.findUnique({
      where: { id: params.id },
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
        submissions: {
          include: {
            student: {
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
      },
    });

    if (!homework) {
      return NextResponse.json(
        { error: "Devoir non trouvé" },
        { status: 404 }
      );
    }

    // Check access based on role
    const userRole = session.user.role;

    if (userRole === "STUDENT") {
      // Student can only see if they're in the class
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
        include: {
          enrollments: {
            where: {
              status: "ACTIVE",
              classId: homework.classSubject.classId,
            },
          },
        },
      });

      if (!studentProfile || studentProfile.enrollments.length === 0) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    return NextResponse.json(homework);
  } catch (error) {
    logger.error(" fetching homework:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du devoir" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/homework/[id]
 * Update homework (Teacher only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = updateHomeworkSchema.parse(body);

    // Check if homework exists
    const existingHomework = await prisma.homework.findUnique({
      where: { id: params.id },
      include: {
        classSubject: {
          select: { teacherId: true },
        },
      },
    });

    if (!existingHomework) {
      return NextResponse.json(
        { error: "Devoir non trouvé" },
        { status: 404 }
      );
    }

    // Verify teacher ownership
    if (
      session.user.role === "TEACHER" &&
      existingHomework.classSubject.teacherId !== session.user.id
    ) {
      return NextResponse.json(
        { error: "Vous ne pouvez modifier que vos propres devoirs" },
        { status: 403 }
      );
    }

    const updateData: any = { ...validatedData };
    if (validatedData.dueDate) {
      updateData.dueDate = new Date(validatedData.dueDate);
    }

    const updatedHomework = await prisma.homework.update({
      where: { id: params.id },
      data: updateData,
      include: {
        classSubject: {
          include: {
            class: {
              include: {
                classLevel: true,
              },
            },
            subject: true,
          },
        },
      },
    });

    return NextResponse.json(updatedHomework);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }

    logger.error(" updating homework:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du devoir" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/homework/[id]
 * Delete homework (Teacher only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const existingHomework = await prisma.homework.findUnique({
      where: { id: params.id },
      include: {
        classSubject: {
          select: { teacherId: true },
        },
      },
    });

    if (!existingHomework) {
      return NextResponse.json(
        { error: "Devoir non trouvé" },
        { status: 404 }
      );
    }

    // Verify teacher ownership
    if (
      session.user.role === "TEACHER" &&
      existingHomework.classSubject.teacherId !== session.user.id
    ) {
      return NextResponse.json(
        { error: "Vous ne pouvez supprimer que vos propres devoirs" },
        { status: 403 }
      );
    }

    await prisma.homework.delete({
      where: { id: params.id },
    });

    return NextResponse.json(
      { message: "Devoir supprimé avec succès" },
      { status: 200 }
    );
  } catch (error) {
    logger.error(" deleting homework:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du devoir" },
      { status: 500 }
    );
  }
}
