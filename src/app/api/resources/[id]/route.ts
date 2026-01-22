import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

const updateResourceSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().optional(),
  type: z.enum(["LESSON", "EXERCISE", "EXAM", "CORRECTION", "DOCUMENT", "VIDEO", "AUDIO", "OTHER"]).optional(),
  category: z.string().optional(),
  subjectId: z.string().cuid().optional().nullable(),
  classLevelId: z.string().cuid().optional().nullable(),
  isPublic: z.boolean().optional(),
});

/**
 * GET /api/resources/[id]
 * Get resource details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const resource = await prisma.resource.findUnique({
      where: { id: params.id },
      include: {
        subject: true,
        classLevel: true,
        uploadedBy: {
          select: {
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        school: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!resource) {
      return NextResponse.json(
        { error: "Ressource non trouvée" },
        { status: 404 }
      );
    }

    // Check access
    if (resource.schoolId !== session.user.schoolId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const userRole = session.user.role;
    const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"].includes(userRole);

    if (!resource.isPublic && !isAdmin) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    return NextResponse.json(resource);
  } catch (error) {
    logger.error(" fetching resource:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de la ressource" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/resources/[id]
 * Update resource (Uploader or Admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    const allowedRoles = [
      "SUPER_ADMIN",
      "SCHOOL_ADMIN",
      "DIRECTOR",
      "TEACHER",
    ];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = updateResourceSchema.parse(body);

    const existingResource = await prisma.resource.findUnique({
      where: { id: params.id },
    });

    if (!existingResource) {
      return NextResponse.json(
        { error: "Ressource non trouvée" },
        { status: 404 }
      );
    }

    // Verify same school
    if (existingResource.schoolId !== session.user.schoolId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Only uploader or admin can edit
    const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"].includes(
      session.user.role
    );
    if (
      existingResource.uploadedById !== session.user.id &&
      !isAdmin
    ) {
      return NextResponse.json(
        { error: "Vous ne pouvez modifier que vos propres ressources" },
        { status: 403 }
      );
    }

    const updatedResource = await prisma.resource.update({
      where: { id: params.id },
      data: validatedData,
      include: {
        subject: true,
        classLevel: true,
        uploadedBy: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE_RESOURCE",
        entity: "Resource",
        entityId: params.id,
        oldValues: existingResource,
        newValues: validatedData,
      },
    });

    return NextResponse.json(updatedResource);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }

    logger.error(" updating resource:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de la ressource" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/resources/[id]
 * Delete resource (Uploader or Admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    const allowedRoles = [
      "SUPER_ADMIN",
      "SCHOOL_ADMIN",
      "DIRECTOR",
      "TEACHER",
    ];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const resource = await prisma.resource.findUnique({
      where: { id: params.id },
    });

    if (!resource) {
      return NextResponse.json(
        { error: "Ressource non trouvée" },
        { status: 404 }
      );
    }

    // Verify same school
    if (resource.schoolId !== session.user.schoolId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Only uploader or admin can delete
    const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"].includes(
      session.user.role
    );
    if (resource.uploadedById !== session.user.id && !isAdmin) {
      return NextResponse.json(
        { error: "Vous ne pouvez supprimer que vos propres ressources" },
        { status: 403 }
      );
    }

    await prisma.resource.delete({
      where: { id: params.id },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE_RESOURCE",
        entity: "Resource",
        entityId: params.id,
        oldValues: resource,
      },
    });

    return NextResponse.json({
      message: "Ressource supprimée avec succès",
    });
  } catch (error) {
    logger.error(" deleting resource:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de la ressource" },
      { status: 500 }
    );
  }
}
