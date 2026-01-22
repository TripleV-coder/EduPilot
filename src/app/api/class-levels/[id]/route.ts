import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { classLevelSchema } from "@/lib/validations/school";
import { logger } from "@/lib/utils/logger";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const classLevel = await prisma.classLevel.findUnique({
      where: { id },
      include: {
        classes: {
          include: {
            _count: {
              select: { enrollments: true },
            },
          },
        },
      },
    });

    if (!classLevel) {
      return NextResponse.json({ error: "Niveau non trouvé" }, { status: 404 });
    }

    if (
      session.user.role !== "SUPER_ADMIN" &&
      classLevel.schoolId !== session.user.schoolId
    ) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    return NextResponse.json(classLevel);
  } catch (error) {
    logger.error(" fetching class level:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du niveau" },
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

    const existingLevel = await prisma.classLevel.findUnique({
      where: { id },
    });

    if (!existingLevel) {
      return NextResponse.json({ error: "Niveau non trouvé" }, { status: 404 });
    }

    if (
      session.user.role !== "SUPER_ADMIN" &&
      existingLevel.schoolId !== session.user.schoolId
    ) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = classLevelSchema.partial().parse(body);

    const updatedLevel = await prisma.classLevel.update({
      where: { id },
      data: validatedData,
    });

    return NextResponse.json(updatedLevel);
  } catch (error: unknown) {
    logger.error(" updating class level:", error as Error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du niveau" },
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

    const existingLevel = await prisma.classLevel.findUnique({
      where: { id },
    });

    if (!existingLevel) {
      return NextResponse.json({ error: "Niveau non trouvé" }, { status: 404 });
    }

    if (
      session.user.role !== "SUPER_ADMIN" &&
      existingLevel.schoolId !== session.user.schoolId
    ) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    await prisma.classLevel.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(" deleting class level:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du niveau" },
      { status: 500 }
    );
  }
}
