import { NextResponse } from "next/server";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { canAccessSchool, ensureRequestedSchoolAccess, getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";
import { createApiHandler } from "@/lib/api/api-helpers";

const periodSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  type: z.enum(["TRIMESTER", "SEMESTER", "HYBRID"]),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  sequence: z.number().int().positive(),
});

const MANAGE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];

/**
 * GET /api/periods
 * List periods for an academic year
 */
export const GET = createApiHandler(
  async (request, context) => {
    const session = context.session;

    const { searchParams } = new URL(request.url);
    let academicYearId = searchParams.get("academicYearId");
    const requestedSchoolId = searchParams.get("schoolId");
    const schoolAccess = ensureRequestedSchoolAccess(session, requestedSchoolId);
    if (schoolAccess) return schoolAccess;
    const activeSchoolId = getActiveSchoolId(session);
    const schoolId = requestedSchoolId || (session.user.role !== "SUPER_ADMIN" ? activeSchoolId : null);

    if (!academicYearId && schoolId) {
      // Find current academic year for the school
      const currentYear = await prisma.academicYear.findFirst({
        where: {
          schoolId: schoolId,
          isCurrent: true
        }
      });
      if (currentYear) {
        academicYearId = currentYear.id;
      }
    }

    if (!academicYearId) {
      return NextResponse.json({ error: "Année scolaire requise (ou année courante non trouvée)" }, { status: 400 });
    }

    const academicYear = await prisma.academicYear.findUnique({
      where: { id: academicYearId },
      select: { schoolId: true },
    });

    if (!academicYear) {
      return NextResponse.json({ error: "Année scolaire non trouvée" }, { status: 404 });
    }

    if (session.user.role !== "SUPER_ADMIN" && !canAccessSchool(session, academicYear.schoolId)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const periods = await prisma.period.findMany({
      where: { academicYearId },
      orderBy: { sequence: "asc" },
    });

    return NextResponse.json(periods);
  },
);

/**
 * POST /api/periods
 * Create a new period
 */
export const POST = createApiHandler(
  async (request, context) => {
    const session = context.session;

    try {
      const body = await request.json();
      const validatedData = periodSchema.parse(body);

      // Verify academic year exists and belongs to user's school


      // Get academic year with proper validation
      const academicYearId = body.academicYearId;
      if (!academicYearId) {
        return NextResponse.json({ error: "Année scolaire requise" }, { status: 400 });
      }

      const year = await prisma.academicYear.findUnique({
        where: { id: academicYearId },
      });

      if (!year) {
        return NextResponse.json({ error: "Année scolaire non trouvée" }, { status: 404 });
      }

      // Verify school access
      if (session.user.role !== "SUPER_ADMIN" && !canAccessSchool(session, year.schoolId)) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }

      // Check for duplicate sequence
      const existingSequence = await prisma.period.findFirst({
        where: { academicYearId, sequence: validatedData.sequence },
      });

      if (existingSequence) {
        return NextResponse.json(
          { error: "Une période avec ce numéro existe déjà" },
          { status: 400 }
        );
      }

      const period = await prisma.period.create({
        data: {
          academicYearId,
          name: validatedData.name,
          type: validatedData.type,
          startDate: validatedData.startDate,
          endDate: validatedData.endDate,
          sequence: validatedData.sequence,
        },
      });

      return NextResponse.json(period, { status: 201 });
    } catch (error) {
      if (isZodError(error)) {
        return NextResponse.json(
          { error: "Données invalides", details: error.issues },
          { status: 400 }
        );
      }

      logger.error(" creating period:", error as Error);
      return NextResponse.json(
        { error: "Erreur lors de la création de la période" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: MANAGE_ROLES },
);
