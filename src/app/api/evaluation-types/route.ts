import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { evaluationTypeSchema } from "@/lib/validations/evaluation";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";


export const GET = createApiHandler(
  async (request, { session }, t) => {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get("schoolId") || session.user.schoolId;

    if (!schoolId) {
      // If SUPER_ADMIN but no schoolId provided, maybe error or all?
      // Original code required schoolId.
      if (session.user.role === "SUPER_ADMIN") {
        return NextResponse.json(translateError(API_ERRORS.INVALID_DATA, t), { status: 400 });
      }
      return NextResponse.json(translateError({ error: "Aucun établissement associé", key: "api.issues.no_school_associated" }, t), { status: 400 });
    }

    if (session.user.role !== "SUPER_ADMIN" && schoolId !== session.user.schoolId) {
      return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
    }

    const evaluationTypes = await prisma.evaluationType.findMany({
      where: { schoolId, isActive: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(evaluationTypes);
  },
  {
    requireAuth: true,
    // Permissions? Usually shared config read, or public within school?
    // Let's assume generic read permission or auth required.
    // Original permitted all auth.
  }
);

export const POST = createApiHandler(
  async (request, { session }, t) => {
    const body = await request.json();
    let schoolId = session.user.schoolId;

    if (session.user.role === "SUPER_ADMIN" && body.schoolId) {
      schoolId = body.schoolId;
    }

    if (!schoolId) {
      return NextResponse.json(translateError({ error: "Établissement requis", key: "api.issues.school_required" }, t), { status: 400 });
    }

    const validatedData = evaluationTypeSchema.parse(body);

    // Check if code already exists
    const existing = await prisma.evaluationType.findFirst({
      where: { schoolId, code: validatedData.code },
    });

    if (existing) {
      return NextResponse.json(
        translateError(API_ERRORS.ALREADY_EXISTS("Un type d'évaluation avec ce code"), t),
        { status: 400 }
      );
    }

    const evaluationType = await prisma.evaluationType.create({
      data: {
        schoolId,
        name: validatedData.name,
        code: validatedData.code,
        weight: validatedData.weight,
        maxCount: validatedData.maxCount,
      },
    });

    return NextResponse.json(evaluationType, { status: 201 });
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"],
    // Or permissions:
    // requiredPermissions: [Permission.EVALUATION_TYPE_CREATE], // assuming it exists
  }
);
