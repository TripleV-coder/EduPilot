import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

const updateRequestSchema = z.object({
  status: z.enum(["IN_PROGRESS", "COMPLETED", "REJECTED"]),
  notes: z.string().optional(),
  downloadUrl: z.string().url().optional(),
});

/**
 * GET /api/compliance/data-requests/[id]
 * Get specific data request details
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

    const dataRequest = await prisma.dataAccessRequest.findUnique({
      where: { id: id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            schoolId: true,
          },
        },
        processor: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!dataRequest) {
      return NextResponse.json(
        { error: "Demande non trouvée" },
        { status: 404 }
      );
    }

    // Check access
    const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN"].includes(session.user.role);
    if (!isAdmin && dataRequest.userId !== session.user.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    if (session.user.role === "SCHOOL_ADMIN") {
      if (!getActiveSchoolId(session)) {
        return NextResponse.json({ error: "Aucun établissement associé" }, { status: 403 });
      }
      if (dataRequest.user.schoolId !== getActiveSchoolId(session)) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    return NextResponse.json(dataRequest);
  } catch (error) {
    logger.error(" fetching data request:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de la demande" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/compliance/data-requests/[id]
 * Update data request status (Admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN"];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = updateRequestSchema.parse(body);

    const existingRequest = await prisma.dataAccessRequest.findUnique({
      where: { id: id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!existingRequest) {
      return NextResponse.json(
        { error: "Demande non trouvée" },
        { status: 404 }
      );
    }
    if (session.user.role === "SCHOOL_ADMIN") {
      if (!getActiveSchoolId(session)) {
        return NextResponse.json({ error: "Aucun établissement associé" }, { status: 403 });
      }
      const requestUser = await prisma.user.findUnique({
        where: { id: existingRequest.userId },
        select: { schoolId: true },
      });
      if (!requestUser || requestUser.schoolId !== getActiveSchoolId(session)) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    const updateData: Prisma.DataAccessRequestUpdateInput = {
      status: validatedData.status,
      processor: { connect: { id: session.user.id } },
    };

    if (validatedData.notes) {
      updateData.notes = validatedData.notes;
    }

    if (validatedData.downloadUrl) {
      updateData.downloadUrl = validatedData.downloadUrl;
    }

    if (validatedData.status === "COMPLETED") {
      updateData.completedAt = new Date();
    }

    const updatedRequest = await prisma.dataAccessRequest.update({
      where: { id: id },
      data: updateData,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        processor: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Create notification for user
    await prisma.notification.create({
      data: {
        userId: existingRequest.userId,
        type: validatedData.status === "COMPLETED" ? "SUCCESS" : validatedData.status === "REJECTED" ? "WARNING" : "INFO",
        title: `Demande RGPD - ${validatedData.status}`,
        message: `Votre demande de type "${existingRequest.requestType}" a été ${
          validatedData.status === "COMPLETED" ? "complétée" :
          validatedData.status === "REJECTED" ? "rejetée" : "mise en cours de traitement"
        }`,
        link: `/compliance/data-requests/${id}`,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE_DATA_REQUEST",
        entity: "DataAccessRequest",
        entityId: id,
        oldValues: { status: existingRequest.status } as Prisma.InputJsonValue,
        newValues: updateData as any,
      },
    });

    return NextResponse.json(updatedRequest);
  } catch (error) {
    if (isZodError(error)) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }

    logger.error(" updating data request:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de la demande" },
      { status: 500 }
    );
  }
}
