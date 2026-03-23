import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { Prisma, NotificationType } from "@prisma/client";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { assertModelAccess } from "@/lib/security/tenant";

const updateAppointmentSchema = z.object({
  status: z.enum(["CONFIRMED", "CANCELED", "COMPLETED", "NO_SHOW"]).optional(),
  cancelReason: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * GET /api/appointments/[id]
 * Get appointment details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const guard = await assertModelAccess(session, "appointment", id, "Rendez-vous non trouvé");
    if (guard) return guard;

    const appointment = await prisma.appointment.findUnique({
      where: { id: id },
      include: {
        teacher: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        parent: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        student: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!appointment) {
      return NextResponse.json(
        { error: "Rendez-vous non trouvé" },
        { status: 404 }
      );
    }

    // Check access
    const userRole = session.user.role;
    const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"].includes(userRole);

    if (!isAdmin) {
      const hasAccess =
        (userRole === "TEACHER" && appointment.teacher.userId === session.user.id) ||
        (userRole === "PARENT" && appointment.parent.userId === session.user.id) ||
        (userRole === "STUDENT" && appointment.student.userId === session.user.id);

      if (!hasAccess) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    return NextResponse.json(appointment);
  } catch (error) {
    logger.error(" fetching appointment:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du rendez-vous" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/appointments/[id]
 * Update appointment (confirm, cancel, complete)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const guard = await assertModelAccess(session, "appointment", id, "Rendez-vous non trouvé");
    if (guard) return guard;

    const body = await request.json();
    const validatedData = updateAppointmentSchema.parse(body);

    const existingAppointment = await prisma.appointment.findUnique({
      where: { id: id },
      include: {
        teacher: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        parent: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        student: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!existingAppointment) {
      return NextResponse.json(
        { error: "Rendez-vous non trouvé" },
        { status: 404 }
      );
    }

    // Check authorization
    const userRole = session.user.role;
    const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"].includes(userRole);
    const isTeacher = userRole === "TEACHER" && existingAppointment.teacher.userId === session.user.id;
    const isParent = userRole === "PARENT" && existingAppointment.parent.userId === session.user.id;

    if (!isAdmin && !isTeacher && !isParent) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const updateData: Prisma.AppointmentUpdateInput = {};

    if (validatedData.status) {
      updateData.status = validatedData.status;

      if (validatedData.status === "CONFIRMED") {
        updateData.confirmedAt = new Date();
      } else if (validatedData.status === "CANCELED") {
        updateData.canceledAt = new Date();
        if (validatedData.cancelReason) {
          updateData.cancelReason = validatedData.cancelReason;
        }
      }
    }

    if (validatedData.notes) {
      updateData.notes = validatedData.notes;
    }

    const updatedAppointment = await prisma.appointment.update({
      where: { id: id },
      data: updateData,
      include: {
        teacher: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        parent: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        student: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    // Create notifications based on status change
    if (validatedData.status) {
      const notificationMap: Record<string, { title: string; message: string; type: NotificationType }> = {
        CONFIRMED: {
          title: "Rendez-vous confirmé",
          message: `Le rendez-vous du ${new Date(updatedAppointment.scheduledAt).toLocaleString("fr-FR")} a été confirmé`,
          type: "SUCCESS",
        },
        CANCELED: {
          title: "Rendez-vous annulé",
          message: `Le rendez-vous du ${new Date(updatedAppointment.scheduledAt).toLocaleString("fr-FR")} a été annulé${
            validatedData.cancelReason ? `: ${validatedData.cancelReason}` : ""
          }`,
          type: "WARNING",
        },
        COMPLETED: {
          title: "Rendez-vous terminé",
          message: `Le rendez-vous avec ${updatedAppointment.teacher.user.firstName} ${updatedAppointment.teacher.user.lastName} s'est bien déroulé`,
          type: "INFO",
        },
        NO_SHOW: {
          title: "Absence au rendez-vous",
          message: `Le rendez-vous du ${new Date(updatedAppointment.scheduledAt).toLocaleString("fr-FR")} n'a pas eu lieu`,
          type: "WARNING",
        },
      };

      const notifConfig = notificationMap[validatedData.status];

      if (notifConfig) {
        // Notify both parties
        await Promise.all([
          prisma.notification.create({
            data: {
              userId: updatedAppointment.teacher.user.id,
              type: notifConfig.type,
              title: notifConfig.title,
              message: notifConfig.message,
              link: `/appointments/${id}`,
            },
          }),
          prisma.notification.create({
            data: {
              userId: updatedAppointment.parent.user.id,
              type: notifConfig.type,
              title: notifConfig.title,
              message: notifConfig.message,
              link: `/appointments/${id}`,
            },
          }),
        ]);
      }
    }

    return NextResponse.json(updatedAppointment);
  } catch (error) {
    if (isZodError(error)) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }

    logger.error(" updating appointment:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du rendez-vous" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/appointments/[id]
 * Delete appointment (Admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    const guard = await assertModelAccess(session, "appointment", id, "Rendez-vous non trouvé");
    if (guard) return guard;

    await prisma.appointment.delete({
      where: { id: id },
    });

    return NextResponse.json({
      message: "Rendez-vous supprimé avec succès",
    });
  } catch (error) {
    logger.error(" deleting appointment:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du rendez-vous" },
      { status: 500 }
    );
  }
}
