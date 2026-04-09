import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";

const updatePeriodSchema = z.object({
  name: z.string().min(1).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  sequence: z.number().int().positive().optional(),
});

/**
 * GET /api/periods/[id]
 * Get a single period
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

    const period = await prisma.period.findUnique({
      where: { id: id },
      include: {
        academicYear: {
          include: { school: true },
        },
      },
    });

    if (!period) {
      return NextResponse.json({ error: "Période non trouvée" }, { status: 404 });
    }

    // Verify school access
    if (session.user.role !== "SUPER_ADMIN" &&
        !canAccessSchool(session, period.academicYear.schoolId)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    return NextResponse.json(period);
  } catch (error) {
    logger.error(" fetching period:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de la période" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/periods/[id]
 * Update a period
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];
    if (!allowedRoles.includes(session.user.role as string)) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = updatePeriodSchema.parse(body);

    const existingPeriod = await prisma.period.findUnique({
      where: { id: id },
      include: { academicYear: true },
    });

    if (!existingPeriod) {
      return NextResponse.json({ error: "Période non trouvée" }, { status: 404 });
    }

    // Verify school access
    if (session.user.role !== "SUPER_ADMIN" &&
        !canAccessSchool(session, existingPeriod.academicYear.schoolId)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Check for duplicate sequence if changing
    if (validatedData.sequence && validatedData.sequence !== existingPeriod.sequence) {
      const duplicate = await prisma.period.findFirst({
        where: {
          academicYearId: existingPeriod.academicYearId,
          sequence: validatedData.sequence,
          id: { not: id },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { error: "Une période avec ce numéro existe déjà" },
          { status: 400 }
        );
      }
    }

    const period = await prisma.period.update({
      where: { id: id },
      data: validatedData,
    });

    return NextResponse.json(period);
  } catch (error) {
    if (isZodError(error)) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }

    logger.error(" updating period:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de la période" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/periods/[id]
 * Delete a period
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

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];
    if (!allowedRoles.includes(session.user.role as string)) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const period = await prisma.period.findUnique({
      where: { id: id },
      include: { academicYear: true },
    });

    if (!period) {
      return NextResponse.json({ error: "Période non trouvée" }, { status: 404 });
    }

    // Verify school access
    if (session.user.role !== "SUPER_ADMIN" &&
        !canAccessSchool(session, period.academicYear.schoolId)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Check if period has grades or evaluations
    const gradesCount = await prisma.grade.count({
      where: { evaluation: { periodId: id } },
    });

    if (gradesCount > 0) {
      return NextResponse.json(
        { error: "Impossible de supprimer cette période : des notes sont associées" },
        { status: 400 }
      );
    }

    await prisma.period.delete({ where: { id: id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(" deleting period:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de la période" },
      { status: 500 }
    );
  }
}
