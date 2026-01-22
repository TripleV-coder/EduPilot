import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

const participationSchema = z.object({
  studentId: z.string().cuid(),
  permissionGiven: z.boolean().default(false),
  notes: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = participationSchema.parse(body);

    // Check if event exists
    const event = await prisma.schoolEvent.findUnique({
      where: { id: params.id },
    });

    if (!event) {
      return NextResponse.json({ error: "Événement non trouvé" }, { status: 404 });
    }

    // Check if already registered
    const existing = await prisma.eventParticipation.findUnique({
      where: {
        eventId_studentId: {
          eventId: params.id,
          studentId: validatedData.studentId,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "Déjà inscrit" }, { status: 400 });
    }

    // Check max participants
    if (event.maxParticipants) {
      const count = await prisma.eventParticipation.count({
        where: { eventId: params.id },
      });
      if (count >= event.maxParticipants) {
        return NextResponse.json({ error: "Événement complet" }, { status: 400 });
      }
    }

    const participation = await prisma.eventParticipation.create({
      data: {
        eventId: params.id,
        studentId: validatedData.studentId,
        permissionGiven: validatedData.permissionGiven,
        permissionBy: validatedData.permissionGiven ? session.user.id : null,
        notes: validatedData.notes,
        paymentStatus: event.fee ? "PENDING" : "NOT_REQUIRED",
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
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
    }
    logger.error(" creating participation:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
