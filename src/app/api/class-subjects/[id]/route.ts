import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { classSubjectSchema } from "@/lib/validations/subject";
import { logger } from "@/lib/utils/logger";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const classSubject = await prisma.classSubject.findUnique({
      where: { id },
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
        evaluations: {
          include: {
            period: true,
            type: true,
            _count: {
              select: { grades: true },
            },
          },
        },
      },
    });

    if (!classSubject) {
      return NextResponse.json({ error: "Affectation non trouvée" }, { status: 404 });
    }

    if (
      session.user.role !== "SUPER_ADMIN" &&
      classSubject.class.schoolId !== session.user.schoolId
    ) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    return NextResponse.json(classSubject);
  } catch (error) {
    logger.error(" fetching class subject:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'affectation" },
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

    const existingClassSubject = await prisma.classSubject.findUnique({
      where: { id },
      include: { class: true },
    });

    if (!existingClassSubject) {
      return NextResponse.json({ error: "Affectation non trouvée" }, { status: 404 });
    }

    if (
      session.user.role !== "SUPER_ADMIN" &&
      existingClassSubject.class.schoolId !== session.user.schoolId
    ) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = classSubjectSchema.partial().parse(body);

    const updatedClassSubject = await prisma.classSubject.update({
      where: { id },
      data: validatedData,
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
    });

    return NextResponse.json(updatedClassSubject);
  } catch (error: unknown) {
    logger.error(" updating class subject:", error as Error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'affectation" },
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

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];
    if (!allowedRoles.includes(session.user.role as string)) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const existingClassSubject = await prisma.classSubject.findUnique({
      where: { id },
      include: { class: true },
    });

    if (!existingClassSubject) {
      return NextResponse.json({ error: "Affectation non trouvée" }, { status: 404 });
    }

    if (
      session.user.role !== "SUPER_ADMIN" &&
      existingClassSubject.class.schoolId !== session.user.schoolId
    ) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    await prisma.classSubject.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(" deleting class subject:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'affectation" },
      { status: 500 }
    );
  }
}
