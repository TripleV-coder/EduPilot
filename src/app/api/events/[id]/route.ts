import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { EventType } from "@prisma/client";
import { isZodError } from "@/lib/is-zod-error";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { roleSatisfies } from "@/lib/rbac/permissions";
import { createApiHandler } from "@/lib/api/api-helpers";

type RouteContext = { params: Promise<{ id: string }> };

const eventSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  description: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  location: z.string().optional(),
  type: z.enum([
    "CEREMONY",
    "CONFERENCE",
    "COMPETITION",
    "CULTURAL",
    "SPORTS",
    "PARENT_MEETING",
    "TRAINING",
    "OTHER",
  ]),
  isPublic: z.boolean().optional(),
});

export const GET = createApiHandler(async (request, context) => {
    try {
        const session = context.session;
    const { id } = await context.params;

    const event = await prisma.schoolEvent.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { firstName: true, lastName: true },
        },
        participations: {
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json(
        { error: "Événement non trouvé" },
        { status: 404 }
      );
    }

    if (
      session.user.role !== "SUPER_ADMIN" &&
      event.schoolId !== getActiveSchoolId(session)
    ) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    return NextResponse.json(event);
  
    } catch (error) {
    logger.error("Error fetching event:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'événement" },
      { status: 500 }
    );
  }

});

export const PATCH = createApiHandler(async (request, context) => {
    try {
        const session = context.session;
    const { id } = await context.params;

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];
    if (!roleSatisfies(session.user.role as string, allowedRoles)) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    const existingEvent = await prisma.schoolEvent.findUnique({
      where: { id },
    });

    if (!existingEvent) {
      return NextResponse.json(
        { error: "Événement non trouvé" },
        { status: 404 }
      );
    }

    if (
      session.user.role !== "SUPER_ADMIN" &&
      existingEvent.schoolId !== getActiveSchoolId(session)
    ) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = eventSchema.partial().parse(body);

    const updatedEvent = await prisma.schoolEvent.update({
      where: { id },
      data: {
        ...(validatedData.title !== undefined ? { title: validatedData.title } : {}),
        ...(validatedData.description !== undefined ? { description: validatedData.description } : {}),
        ...(validatedData.startDate !== undefined ? { startDate: new Date(validatedData.startDate) } : {}),
        ...(validatedData.endDate !== undefined ? { endDate: new Date(validatedData.endDate) } : {}),
        ...(validatedData.location !== undefined ? { location: validatedData.location } : {}),
        ...(validatedData.type !== undefined ? { type: validatedData.type as EventType } : {}),
      },
    });

    return NextResponse.json(updatedEvent);
  
    } catch (error: unknown) {
    logger.error("Error updating event:", error as Error);
    if (isZodError(error)) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'événement" },
      { status: 500 }
    );
  }

});

export const DELETE = createApiHandler(async (request, context) => {
    try {
        const session = context.session;
    const { id } = await context.params;

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];
    if (!roleSatisfies(session.user.role as string, allowedRoles)) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    const existingEvent = await prisma.schoolEvent.findUnique({
      where: { id },
    });

    if (!existingEvent) {
      return NextResponse.json(
        { error: "Événement non trouvé" },
        { status: 404 }
      );
    }

    if (
      session.user.role !== "SUPER_ADMIN" &&
      existingEvent.schoolId !== getActiveSchoolId(session)
    ) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Soft delete: unpublish instead of permanently removing
    await prisma.schoolEvent.update({
      where: { id },
      data: { isPublished: false },
    });

    return NextResponse.json({ success: true, archived: true });
  
    } catch (error) {
    logger.error("Error deleting event:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'événement" },
      { status: 500 }
    );
  }

});
