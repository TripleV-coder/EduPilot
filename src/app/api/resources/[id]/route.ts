import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { softDelete } from "@/lib/db/soft-delete";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { assertModelAccess } from "@/lib/security/tenant";

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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const guard = await assertModelAccess(session, "resource", id, "Ressource non trouvée");
    if (guard) return guard;

    const resource = await prisma.resource.findUnique({
      where: { id },
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    const guard = await assertModelAccess(session, "resource", id, "Ressource non trouvée");
    if (guard) return guard;

    const body = await request.json();
    const validatedData = updateResourceSchema.parse(body);

    const existingResource = await prisma.resource.findUnique({
      where: { id: id },
    });

    if (!existingResource) {
      return NextResponse.json(
        { error: "Ressource non trouvée" },
        { status: 404 }
      );
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
      where: { id: id },
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
        entityId: id,
        oldValues: existingResource,
        newValues: validatedData,
      },
    });

    await invalidateByPath(CACHE_PATHS.resources);

    return NextResponse.json(updatedResource);
  } catch (error) {
    if (isZodError(error)) {
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    const guard = await assertModelAccess(session, "resource", id, "Ressource non trouvée");
    if (guard) return guard;

    const resource = await prisma.resource.findUnique({
      where: { id: id },
    });

    if (!resource) {
      return NextResponse.json(
        { error: "Ressource non trouvée" },
        { status: 404 }
      );
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

    // Soft delete the resource instead of hard delete
    await softDelete("resource", id);

    await invalidateByPath(CACHE_PATHS.resources);

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE_RESOURCE",
        entity: "Resource",
        entityId: id,
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
