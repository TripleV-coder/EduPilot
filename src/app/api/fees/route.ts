import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { feeSchema } from "@/lib/validations/finance";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";
import { ensureRequestedSchoolAccess, getActiveSchoolId } from "@/lib/api/tenant-isolation";

/**
 * GET /api/fees
 * Lister les frais scolaires
 */
export const GET = createApiHandler(
  async (request, { session }, t) => {
    const { searchParams } = new URL(request.url);
    const requestedSchoolId = searchParams.get("schoolId");
    const schoolAccess = ensureRequestedSchoolAccess(session, requestedSchoolId);
    if (schoolAccess) return schoolAccess;
    const schoolId = requestedSchoolId || getActiveSchoolId(session);

    if (!schoolId) {
      return NextResponse.json(translateError(API_ERRORS.INVALID_DATA, t), { status: 400 });
    }

    const fees = await prisma.fee.findMany({
      where: { schoolId, isActive: true },
      include: {
        academicYear: true,
        payments: {
          include: {
            student: {
              include: {
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(fees);
  },
  {
    requireAuth: true,
  }
);

/**
 * POST /api/fees
 * Créer un frais scolaire
 */
export const POST = createApiHandler(
  async (request, { session }, t) => {
    const body = await request.json();
    const data = feeSchema.parse(body);
    const requestedSchoolId = (body as any).schoolId as string | undefined;
    const schoolAccess = ensureRequestedSchoolAccess(session, requestedSchoolId);
    if (schoolAccess) return schoolAccess;

    // Determine schoolId
    let schoolId = getActiveSchoolId(session);
    if (requestedSchoolId) {
      schoolId = requestedSchoolId;
    }

    if (!schoolId) {
      return NextResponse.json(translateError(API_ERRORS.INVALID_DATA, t), { status: 400 });
    }

    const fee = await prisma.fee.create({
      data: {
        schoolId,
        name: data.name,
        description: data.description,
        amount: data.amount,
        academicYearId: data.academicYearId,
        classLevelCode: data.classLevelCode,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        isRequired: data.isRequired,
      },
    });

    return NextResponse.json(fee, { status: 201 });
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"],
  }
);
