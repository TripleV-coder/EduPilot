import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { scheduleSchema } from "@/lib/validations/schedule";
import { logger } from "@/lib/utils/logger";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const schedule = await prisma.schedule.findUnique({
      where: { id },
      include: {
        class: {
          include: { classLevel: true },
        },
        classSubject: {
          include: {
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
      },
    });

    if (!schedule) {
      return NextResponse.json({ error: "Créneau non trouvé" }, { status: 404 });
    }

    if (
      session.user.role !== "SUPER_ADMIN" &&
      schedule.class.schoolId !== session.user.schoolId
    ) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    return NextResponse.json(schedule);
  } catch (error) {
    logger.error(" fetching schedule:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du créneau" },
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

    const existingSchedule = await prisma.schedule.findUnique({
      where: { id },
      include: { class: true },
    });

    if (!existingSchedule) {
      return NextResponse.json({ error: "Créneau non trouvé" }, { status: 404 });
    }

    if (
      session.user.role !== "SUPER_ADMIN" &&
      existingSchedule.class.schoolId !== session.user.schoolId
    ) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = scheduleSchema.partial().parse(body);

    const updatedSchedule = await prisma.schedule.update({
      where: { id },
      data: validatedData,
      include: {
        class: {
          include: { classLevel: true },
        },
      },
    });

    return NextResponse.json(updatedSchedule);
  } catch (error: unknown) {
    logger.error(" updating schedule:", error as Error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du créneau" },
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

    const existingSchedule = await prisma.schedule.findUnique({
      where: { id },
      include: { class: true },
    });

    if (!existingSchedule) {
      return NextResponse.json({ error: "Créneau non trouvé" }, { status: 404 });
    }

    if (
      session.user.role !== "SUPER_ADMIN" &&
      existingSchedule.class.schoolId !== session.user.schoolId
    ) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    await prisma.schedule.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(" deleting schedule:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du créneau" },
      { status: 500 }
    );
  }
}
