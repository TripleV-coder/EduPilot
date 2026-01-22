import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { academicYearSchema } from "@/lib/validations/school";
import { logger } from "@/lib/utils/logger";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const academicYear = await prisma.academicYear.findUnique({
      where: { id },
      include: {
        periods: {
          orderBy: { sequence: "asc" },
        },
        enrollments: {
          include: {
            student: {
              include: {
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
            class: {
              include: { classLevel: true },
            },
          },
        },
      },
    });

    if (!academicYear) {
      return NextResponse.json({ error: "Année scolaire non trouvée" }, { status: 404 });
    }

    if (
      session.user.role !== "SUPER_ADMIN" &&
      academicYear.schoolId !== session.user.schoolId
    ) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    return NextResponse.json(academicYear);
  } catch (error) {
    logger.error(" fetching academic year:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'année scolaire" },
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

    const existingYear = await prisma.academicYear.findUnique({
      where: { id },
    });

    if (!existingYear) {
      return NextResponse.json({ error: "Année scolaire non trouvée" }, { status: 404 });
    }

    if (
      session.user.role !== "SUPER_ADMIN" &&
      existingYear.schoolId !== session.user.schoolId
    ) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = academicYearSchema.partial().parse(body);

    // If setting as current, unset other current years
    if (validatedData.isCurrent) {
      await prisma.academicYear.updateMany({
        where: {
          schoolId: existingYear.schoolId,
          id: { not: id },
        },
        data: { isCurrent: false },
      });
    }

    const updatedYear = await prisma.academicYear.update({
      where: { id },
      data: validatedData,
      include: {
        periods: {
          orderBy: { sequence: "asc" },
        },
      },
    });

    return NextResponse.json(updatedYear);
  } catch (error: unknown) {
    logger.error(" updating academic year:", error as Error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'année scolaire" },
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

    const existingYear = await prisma.academicYear.findUnique({
      where: { id },
    });

    if (!existingYear) {
      return NextResponse.json({ error: "Année scolaire non trouvée" }, { status: 404 });
    }

    if (
      session.user.role !== "SUPER_ADMIN" &&
      existingYear.schoolId !== session.user.schoolId
    ) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    await prisma.academicYear.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(" deleting academic year:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'année scolaire" },
      { status: 500 }
    );
  }
}
