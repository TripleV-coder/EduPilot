import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isZodError } from "@/lib/is-zod-error";
import { auth } from "@/lib/auth";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

const evaluationTypeUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  code: z.string().min(1).max(10).optional(),
  weight: z.coerce.number().min(0).max(10).optional(),
  maxCount: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const evaluationType = await prisma.evaluationType.findUnique({
      where: { id },
      include: {
        evaluations: {
          include: {
            classSubject: {
              include: {
                class: true,
                subject: true,
              },
            },
          },
          take: 10,
        },
      },
    });

    if (!evaluationType) {
      return NextResponse.json({ error: "Type d'évaluation non trouvé" }, { status: 404 });
    }

    if (
      session.user.role !== "SUPER_ADMIN" &&
      !canAccessSchool(session, evaluationType.schoolId)
    ) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    return NextResponse.json(evaluationType);
  } catch (error) {
    logger.error(" fetching evaluation type:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du type d'évaluation" },
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

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];
    if (!allowedRoles.includes(session.user.role as string)) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const existingType = await prisma.evaluationType.findUnique({
      where: { id },
    });

    if (!existingType) {
      return NextResponse.json({ error: "Type d'évaluation non trouvé" }, { status: 404 });
    }

    if (
      session.user.role !== "SUPER_ADMIN" &&
      !canAccessSchool(session, existingType.schoolId)
    ) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = evaluationTypeUpdateSchema.parse(body);

    const updatedType = await prisma.evaluationType.update({
      where: { id },
      data: validatedData,
    });

    return NextResponse.json(updatedType);
  } catch (error: unknown) {
    logger.error(" updating evaluation type:", error as Error);
    if (isZodError(error)) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du type d'évaluation" },
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

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN"];
    if (!allowedRoles.includes(session.user.role as string)) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const existingType = await prisma.evaluationType.findUnique({
      where: { id },
    });

    if (!existingType) {
      return NextResponse.json({ error: "Type d'évaluation non trouvé" }, { status: 404 });
    }

    if (
      session.user.role !== "SUPER_ADMIN" &&
      !canAccessSchool(session, existingType.schoolId)
    ) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    await prisma.evaluationType.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(" deleting evaluation type:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du type d'évaluation" },
      { status: 500 }
    );
  }
}
