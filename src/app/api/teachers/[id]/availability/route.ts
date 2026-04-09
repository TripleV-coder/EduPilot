import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { isTeacherAssignedToSchool } from "@/lib/teachers/school-assignments";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

const availabilitySchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  isActive: z.boolean().default(true),
});

/**
 * GET /api/teachers/[id]/availability
 * Get teacher availability slots
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

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { id },
      select: { schoolId: true },
    });

    if (!teacherProfile) {
      return NextResponse.json(
        { error: "Profil enseignant non trouvé" },
        { status: 404 }
      );
    }

    const activeSchoolId = getActiveSchoolId(session);

    if (
      session.user.role !== "SUPER_ADMIN" &&
      (!activeSchoolId || !(await isTeacherAssignedToSchool(id, activeSchoolId)))
    ) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const availabilities = await prisma.teacherAvailability.findMany({
      where: {
        teacherId: id,
        isActive: true,
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    // Get upcoming booked slots (next 30 days)
    const today = new Date();
    const thirtyDaysLater = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    const bookedSlots = await prisma.appointment.findMany({
      where: {
        teacherId: id,
        scheduledAt: {
          gte: today,
          lte: thirtyDaysLater,
        },
        status: {
          in: ["PENDING", "CONFIRMED"],
        },
      },
      select: {
        scheduledAt: true,
        duration: true,
      },
    });

    return NextResponse.json({
      availabilities,
      bookedSlots,
    });
  } catch (error) {
    logger.error(" fetching availability:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des disponibilités" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/teachers/[id]/availability
 * Set teacher availability (Teacher or Admin only)
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

    // Check authorization
    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { id: id },
      select: { userId: true, schoolId: true },
    });

    if (!teacherProfile) {
      return NextResponse.json(
        { error: "Profil enseignant non trouvé" },
        { status: 404 }
      );
    }

    const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"].includes(session.user.role);
    const isOwner = teacherProfile.userId === session.user.id;
    const activeSchoolId = getActiveSchoolId(session);

    if (
      session.user.role !== "SUPER_ADMIN" &&
      (!activeSchoolId || !(await isTeacherAssignedToSchool(id, activeSchoolId)))
    ) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = availabilitySchema.parse(body);

    // Check for overlapping availability
    const existing = await prisma.teacherAvailability.findFirst({
      where: {
        teacherId: id,
        dayOfWeek: validatedData.dayOfWeek,
        OR: [
          {
            AND: [
              { startTime: { lte: validatedData.startTime } },
              { endTime: { gt: validatedData.startTime } },
            ],
          },
          {
            AND: [
              { startTime: { lt: validatedData.endTime } },
              { endTime: { gte: validatedData.endTime } },
            ],
          },
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Ce créneau chevauche une disponibilité existante" },
        { status: 400 }
      );
    }

    const availability = await prisma.teacherAvailability.create({
      data: {
        teacherId: id,
        dayOfWeek: validatedData.dayOfWeek,
        startTime: validatedData.startTime,
        endTime: validatedData.endTime,
        isActive: validatedData.isActive,
      },
    });

    return NextResponse.json(availability, { status: 201 });
  } catch (error) {
    if (isZodError(error)) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }

    logger.error(" creating availability:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la création de la disponibilité" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/teachers/[id]/availability
 * Delete availability slot
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const availabilityId = searchParams.get("availabilityId");

    if (!availabilityId) {
      return NextResponse.json(
        { error: "ID de disponibilité requis" },
        { status: 400 }
      );
    }

    const teacherProfile = await prisma.teacherProfile.findUnique({
      where: { id: id },
      select: { userId: true, schoolId: true },
    });

    if (!teacherProfile) {
      return NextResponse.json(
        { error: "Profil enseignant non trouvé" },
        { status: 404 }
      );
    }

    const isAdmin = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"].includes(session.user.role);
    const isOwner = teacherProfile.userId === session.user.id;
    const activeSchoolId = getActiveSchoolId(session);

    if (
      session.user.role !== "SUPER_ADMIN" &&
      (!activeSchoolId || !(await isTeacherAssignedToSchool(id, activeSchoolId)))
    ) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    await prisma.teacherAvailability.delete({
      where: { id: availabilityId },
    });

    return NextResponse.json({
      message: "Disponibilité supprimée avec succès",
    });
  } catch (error) {
    logger.error(" deleting availability:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de la disponibilité" },
      { status: 500 }
    );
  }
}
