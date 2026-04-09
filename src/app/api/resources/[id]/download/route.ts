import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";

/**
 * POST /api/resources/[id]/download
 * Increment download counter and return download URL
 */
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
    const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"].includes(userRole);

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
}
