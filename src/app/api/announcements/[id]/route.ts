import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { softDelete } from "@/lib/db/soft-delete";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const announcement = await prisma.announcement.findUnique({
      where: { id },
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = updateAnnouncementSchema.parse(body);

    const existingAnnouncement = await prisma.announcement.findUnique({
      where: { id },
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

    const updateData: Prisma.AnnouncementUpdateInput = { ...validatedData };

    if (validatedData.publishedAt) {
      updateData.publishedAt = new Date(validatedData.publishedAt);
    } else if (validatedData.isPublished && !existingAnnouncement.publishedAt) {
      updateData.publishedAt = new Date();
    }

    if (validatedData.expiresAt) {
      updateData.expiresAt = new Date(validatedData.expiresAt);
    }

    const updatedAnnouncement = await prisma.announcement.update({
      where: { id },
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
        entityId: id,
        oldValues: existingAnnouncement as any,
        newValues: updateData as any,
      },
    });

    await invalidateByPath(CACHE_PATHS.announcements);

    return NextResponse.json(updatedAnnouncement);
  } catch (error) {
    if (isZodError(error)) {
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const announcement = await prisma.announcement.findUnique({
      where: { id },
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

    // Soft delete the announcement instead of hard delete
    await softDelete("announcement", id);

    await invalidateByPath(CACHE_PATHS.announcements);

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE_ANNOUNCEMENT",
        entity: "Announcement",
        entityId: id,
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
