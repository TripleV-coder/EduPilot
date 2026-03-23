import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { softDelete } from "@/lib/db/soft-delete";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { assertModelAccess } from "@/lib/security/tenant";

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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const guard = await assertModelAccess(session, "homework", id, "Devoir non trouvé");
    if (guard) return guard;

    const homework = await prisma.homework.findUnique({
      where: { id },
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    const guard = await assertModelAccess(session, "homework", id, "Devoir non trouvé");
    if (guard) return guard;

    const body = await request.json();
    const validatedData = updateHomeworkSchema.parse(body);

    // Check if homework exists
    const existingHomework = await prisma.homework.findUnique({
      where: { id },
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
    if (session.user.role === "TEACHER") {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (!teacherProfile || existingHomework.classSubject.teacherId !== teacherProfile.id) {
        return NextResponse.json(
          { error: "Vous ne pouvez modifier que vos propres devoirs" },
          { status: 403 }
        );
      }
    }

    const updateData: Prisma.HomeworkUpdateInput = { ...validatedData };
    if (validatedData.dueDate) {
      updateData.dueDate = new Date(validatedData.dueDate);
    }

    const updatedHomework = await prisma.homework.update({
      where: { id: id },
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

    await invalidateByPath(CACHE_PATHS.homework);

    return NextResponse.json(updatedHomework);
  } catch (error) {
    if (isZodError(error)) {
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    const guard = await assertModelAccess(session, "homework", id, "Devoir non trouvé");
    if (guard) return guard;

    const existingHomework = await prisma.homework.findUnique({
      where: { id: id },
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
    if (session.user.role === "TEACHER") {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (!teacherProfile || existingHomework.classSubject.teacherId !== teacherProfile.id) {
        return NextResponse.json(
          { error: "Vous ne pouvez supprimer que vos propres devoirs" },
          { status: 403 }
        );
      }
    }

    // Soft delete the homework instead of hard delete
    await softDelete("homework", id);

    await invalidateByPath(CACHE_PATHS.homework);

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
