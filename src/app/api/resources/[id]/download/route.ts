import { NextResponse } from "next/server";
import { createApiHandler } from "@/lib/api/api-helpers";
import prisma from "@/lib/prisma";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";
import { roleSatisfies } from "@/lib/rbac/permissions";

/**
 * POST /api/resources/[id]/download
 * Increment download counter and return download URL
 */
export const POST = createApiHandler(async (request, context) => {
  try {
    const { id } = await context.params;
    const session = context.session;

    const resource = await prisma.resource.findUnique({
      where: { id: id },
      include: {
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
    if (session.user.role !== "SUPER_ADMIN" && resource.schoolId !== getActiveSchoolId(session)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const userRole = session.user.role;
    const isAdmin = roleSatisfies(userRole, ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"]);

    if (!resource.isPublic && !isAdmin) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Increment download counter
    await prisma.resource.update({
      where: { id: id },
      data: {
        downloads: {
          increment: 1,
        },
      },
    });

    // Create audit log for download
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DOWNLOAD_RESOURCE",
        entity: "Resource",
        entityId: id,
        newValues: {
          title: resource.title,
          type: resource.type,
        },
      },
    });

    return NextResponse.json({
      success: true,
      downloadUrl: resource.fileUrl,
      filename: resource.title,
      fileType: resource.fileType,
    });
  } catch (error) {
    logger.error(" downloading resource:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors du téléchargement de la ressource" },
      { status: 500 }
    );
  }
});
