import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

const participationSchema = z.object({
  studentId: z.string().cuid(),
  permissionGiven: z.boolean().default(false),
  notes: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "PARENT", "STUDENT"];
    if (!allowedRoles.includes(session.user.role)) {
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
        link: `/events/${event.id}`,
      },
    });

    return NextResponse.json(participation, { status: 201 });
  } catch (error) {
    if ((error as any).message === "EVENT_FULL") {
      return NextResponse.json({ error: "Événement complet" }, { status: 400 });
    }
    if (isZodError(error)) {
      return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
    }
    logger.error(" creating participation:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
