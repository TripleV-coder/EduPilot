import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { evaluationSchema } from "@/lib/validations/evaluation";
import { logger } from "@/lib/utils/logger";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const evaluation = await prisma.evaluation.findUnique({
      where: { id },
      include: {
        classSubject: {
          include: {
            class: {
              include: { classLevel: true },
            },
            subject: true,
            teacher: {
              include: {
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        },
        period: true,
        type: true,
        grades: {
          include: {
            student: {
              include: {
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        },
      },
    });

    if (!evaluation) {
      return NextResponse.json({ error: "Évaluation non trouvée" }, { status: 404 });
    }

    return NextResponse.json(evaluation);
  } catch (error) {
    logger.error(" fetching evaluation:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'évaluation" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];
    if (!allowedRoles.includes(session.user.role as string)) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const existingEvaluation = await prisma.evaluation.findUnique({
      where: { id },
      include: {
        classSubject: {
          include: { teacher: true },
        },
      },
    });

    if (!existingEvaluation) {
      return NextResponse.json({ error: "Évaluation non trouvée" }, { status: 404 });
    }

    // Teachers can only update their own evaluations
    if (session.user.role === "TEACHER") {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
      });
      if (existingEvaluation.classSubject.teacherId !== teacherProfile?.id) {
        return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
      }
    }

    const body = await request.json();
    const validatedData = evaluationSchema.partial().parse(body);

    const updatedEvaluation = await prisma.evaluation.update({
      where: { id },
      data: validatedData,
      include: {
        classSubject: {
          include: {
            class: true,
            subject: true,
          },
        },
        period: true,
        type: true,
      },
    });

    return NextResponse.json(updatedEvaluation);
  } catch (error: unknown) {
    logger.error(" updating evaluation:", error as Error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'évaluation" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];
    if (!allowedRoles.includes(session.user.role as string)) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const existingEvaluation = await prisma.evaluation.findUnique({
      where: { id },
      include: {
        classSubject: {
          include: { teacher: true },
        },
      },
    });

    if (!existingEvaluation) {
      return NextResponse.json({ error: "Évaluation non trouvée" }, { status: 404 });
    }

    // Teachers can only delete their own evaluations
    if (session.user.role === "TEACHER") {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
      });
      if (existingEvaluation.classSubject.teacherId !== teacherProfile?.id) {
        return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
      }
    }

    await prisma.evaluation.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(" deleting evaluation:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'évaluation" },
      { status: 500 }
    );
  }
}
