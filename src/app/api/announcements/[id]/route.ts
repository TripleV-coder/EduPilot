import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

const updateAnnouncementSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  content: z.string().min(10).optional(),
  type: z.enum(["GENERAL", "ACADEMIC", "EVENT", "URGENT", "MAINTENANCE", "HOLIDAY"]).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  targetRoles: z.array(z.enum(["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STUDENT", "PARENT", "ACCOUNTANT"])).optional(),
  isPublished: z.boolean().optional(),
  publishedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  attachments: z.array(z.string().url()).optional(),
});

/**
 * GET /api/announcements/[id]
 * Get announcement details
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

    const announcement = await prisma.announcement.findUnique({
      where: { id: params.id },
      include: {
        author: {
          select: {
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        school: {
          select: {
            name: true,
            logo: true,
          },
        },
      },
    });

    if (!announcement) {
      return NextResponse.json(
        { error: "Annonce non trouvée" },
        { status: 404 }
      );
    }

    // Check if user has access (same school and targeted role)
    if (announcement.schoolId !== session.user.schoolId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Check if announcement is published or user is admin
    const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"].includes(
      session.user.role
    );
    if (!announcement.isPublished && !isAdmin) {
      return NextResponse.json(
        { error: "Annonce non publiée" },
        { status: 404 }
      );
    }

    // Check if user's role is targeted
    if (
      !isAdmin &&
      announcement.targetRoles.length > 0 &&
      !announcement.targetRoles.includes(session.user.role)
    ) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    return NextResponse.json(announcement);
  } catch (error) {
    logger.error(" fetching announcement:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'annonce" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/announcements/[id]
 * Update announcement (Admin/Director only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = updateAnnouncementSchema.parse(body);

    const existingAnnouncement = await prisma.announcement.findUnique({
      where: { id: params.id },
    });

    if (!existingAnnouncement) {
      return NextResponse.json(
        { error: "Annonce non trouvée" },
        { status: 404 }
      );
    }

    // Verify same school
    if (existingAnnouncement.schoolId !== session.user.schoolId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const updateData: any = { ...validatedData };

    if (validatedData.publishedAt) {
      updateData.publishedAt = new Date(validatedData.publishedAt);
    } else if (validatedData.isPublished && !existingAnnouncement.publishedAt) {
      updateData.publishedAt = new Date();
    }

    if (validatedData.expiresAt) {
      updateData.expiresAt = new Date(validatedData.expiresAt);
    }

    const updatedAnnouncement = await prisma.announcement.update({
      where: { id: params.id },
      data: updateData,
      include: {
        author: {
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
        action: "UPDATE_ANNOUNCEMENT",
        entity: "Announcement",
        entityId: params.id,
        oldValues: existingAnnouncement,
        newValues: updateData,
      },
    });

    return NextResponse.json(updatedAnnouncement);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }

    logger.error(" updating announcement:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de l'annonce" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/announcements/[id]
 * Delete announcement (Admin/Director only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const announcement = await prisma.announcement.findUnique({
      where: { id: params.id },
    });

    if (!announcement) {
      return NextResponse.json(
        { error: "Annonce non trouvée" },
        { status: 404 }
      );
    }

    // Verify same school
    if (announcement.schoolId !== session.user.schoolId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    await prisma.announcement.delete({
      where: { id: params.id },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE_ANNOUNCEMENT",
        entity: "Announcement",
        entityId: params.id,
        oldValues: announcement,
      },
    });

    return NextResponse.json({
      message: "Annonce supprimée avec succès",
    });
  } catch (error) {
    logger.error(" deleting announcement:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de l'annonce" },
      { status: 500 }
    );
  }
}
