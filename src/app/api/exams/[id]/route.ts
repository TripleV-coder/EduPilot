import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";

/**
 * GET /api/exams/[id]
 * Get exam details with questions
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

    const exam = await prisma.examTemplate.findUnique({
      where: { id },
      include: {
        _count: { select: { questions: true } },
        classSubject: {
          include: {
            subject: { select: { name: true } },
            class: { select: { name: true } },
            teacher: {
              include: {
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        },
        questions: {
          orderBy: { order: "asc" },
          select: {
            id: true,
            type: true,
            question: true,
            points: true,
            order: true,
          },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: "Examen non trouvé" }, { status: 404 });
    }

    // Verify same school if user has a school
    if (session.user.schoolId && exam.classSubject?.class) {
      const classSubject = await prisma.classSubject.findUnique({
        where: { id: exam.classSubjectId },
        include: { class: { select: { schoolId: true } } },
      });
      if (classSubject && classSubject.class.schoolId !== session.user.schoolId) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    return NextResponse.json(exam);
  } catch (error) {
    logger.error("Error fetching exam", error as Error, { module: "api/exams/[id]" });
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'examen" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/exams/[id]
 * Delete an exam template
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const exam = await prisma.examTemplate.findUnique({
      where: { id },
      include: {
        classSubject: {
          include: { class: { select: { schoolId: true } } },
        },
      },
    });

    if (!exam) {
      return NextResponse.json({ error: "Examen non trouvé" }, { status: 404 });
    }

    // Verify same school if user has a school
    if (session.user.schoolId && exam.classSubject?.class.schoolId !== session.user.schoolId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Only creator or admin can delete
    const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"].includes(session.user.role);
    if (exam.createdById !== session.user.id && !isAdmin) {
      return NextResponse.json(
        { error: "Vous ne pouvez supprimer que vos propres examens" },
        { status: 403 }
      );
    }

    await prisma.examTemplate.delete({ where: { id } });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE_EXAM",
        entity: "ExamTemplate",
        entityId: id,
        oldValues: { title: exam.title },
      },
    });

    return NextResponse.json({ message: "Examen supprimé avec succès" });
  } catch (error) {
    logger.error("Error deleting exam", error as Error, { module: "api/exams/[id]" });
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'examen" },
      { status: 500 }
    );
  }
}
