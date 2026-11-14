import { NextResponse } from "next/server";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { roleSatisfies } from "@/lib/rbac/permissions";
import { createApiHandler } from "@/lib/api/api-helpers";
import { familyStudents } from "@/lib/events/family";

const participationSchema = z.object({
  studentId: z.string().cuid(),
  permissionGiven: z.boolean().default(false),
  notes: z.string().optional(),
});

export const POST = createApiHandler(async (request, context) => {
    try {
        const { id } = await context.params;
        const session = context.session;

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "PARENT", "STUDENT"];
    if (!roleSatisfies(session.user.role, allowedRoles)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = participationSchema.parse(body);

    // Check if event exists
    const event = await prisma.schoolEvent.findUnique({
      where: { id: id },
    });

    if (!event) {
      return NextResponse.json({ error: "Événement non trouvé" }, { status: 404 });
    }

    const student = await prisma.studentProfile.findUnique({
      where: { id: validatedData.studentId },
      select: { id: true, userId: true, schoolId: true, user: { select: { id: true } } },
    });

    if (!student) {
      return NextResponse.json({ error: "Élève non trouvé" }, { status: 404 });
    }

    if (event.schoolId !== student.schoolId) {
      return NextResponse.json({ error: "Élève hors établissement" }, { status: 403 });
    }

    if (session.user.role !== "SUPER_ADMIN" && event.schoolId !== getActiveSchoolId(session)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    if (session.user.role === "STUDENT" && student.userId !== session.user.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    if (session.user.role === "PARENT") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });
      if (!parentProfile) {
        return NextResponse.json({ error: "Profil parent non trouvé" }, { status: 403 });
      }
      const isParentOf = await prisma.parentStudent.findUnique({
        where: { parentId_studentId: { parentId: parentProfile.id, studentId: student.id } },
      });
      if (!isParentOf) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    // Check if already registered
    const existing = await prisma.eventParticipation.findUnique({
      where: {
        eventId_studentId: {
          eventId: id,
          studentId: validatedData.studentId,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "Déjà inscrit" }, { status: 400 });
    }

    const participation = await prisma.$transaction(async (tx) => {
      // Re-check max participants inside transaction
      if (event.maxParticipants) {
        const count = await tx.eventParticipation.count({
          where: { eventId: id },
        });
        if (count >= event.maxParticipants) {
          throw new Error("EVENT_FULL");
        }
      }

      return await tx.eventParticipation.create({
        data: {
          eventId: id,
          studentId: validatedData.studentId,
          permissionGiven: validatedData.permissionGiven,
          permissionBy: validatedData.permissionGiven ? session.user.id : null,
          notes: validatedData.notes,
          paymentStatus: event.fee ? "PENDING" : null,
        },
        include: {
          student: {
            include: {
              user: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          },
        },
      });
    });

    // Notify student
    await prisma.notification.create({
      data: {
        userId: participation.student.user.id,
        type: "SUCCESS",
        title: "Inscription événement",
        message: `Vous êtes inscrit à l'événement: ${event.title}`,
        link: "/dashboard/events",
      },
    });

    return NextResponse.json(participation, { status: 201 });
  
    } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      (error as { message: string }).message === "EVENT_FULL"
    ) {
      return NextResponse.json({ error: "Événement complet" }, { status: 400 });
    }
    if (isZodError(error)) {
      return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
    }
    logger.error(" creating participation:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }

});

/**
 * DELETE /api/events/[id]/participate?studentId= — annuler une inscription
 * avant le début de l'évènement : l'élève pour lui-même, le parent pour son
 * enfant, l'école pour tout élève de l'établissement.
 */
export const DELETE = createApiHandler(async (request, context) => {
    const { id } = await context.params;
    const session = context.session;
    // L'évènement d'une autre école répond 404 avant tout contrôle de saisie.
    const event = await prisma.schoolEvent.findUnique({ where: { id }, select: { id: true, schoolId: true, startDate: true } });
    if (!event || (session.user.role !== "SUPER_ADMIN" && event.schoolId !== getActiveSchoolId(session))) {
      return NextResponse.json({ error: "Événement non trouvé" }, { status: 404 });
    }
    const studentId = new URL(request.url).searchParams.get("studentId");
    if (!studentId) return NextResponse.json({ error: "Indiquez l'élève." }, { status: 400 });
    if (event.startDate <= new Date()) {
      return NextResponse.json({ error: "L'évènement a commencé : l'inscription ne peut plus être annulée." }, { status: 409 });
    }
    if (session.user.role === "STUDENT" || session.user.role === "PARENT") {
      const mine = (await familyStudents(session.user)).some((s) => s.id === studentId);
      if (!mine) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    } else if (!roleSatisfies(session.user.role, ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { count } = await prisma.eventParticipation.deleteMany({ where: { eventId: id, studentId } });
    if (count === 0) return NextResponse.json({ error: "Aucune inscription à annuler." }, { status: 404 });
    return NextResponse.json({ success: true });
});
