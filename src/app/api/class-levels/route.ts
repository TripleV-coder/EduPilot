import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { classLevelSchema } from "@/lib/validations/school";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";
import { Permission } from "@/lib/rbac/permissions";


export const GET = createApiHandler(
  async (request, { session }, t) => {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get("schoolId") || session.user.schoolId;

    if (!schoolId) {
      return NextResponse.json(translateError(API_ERRORS.INVALID_DATA, t), { status: 400 });
    }

    if (
      session.user.role !== "SUPER_ADMIN" &&
      schoolId !== session.user.schoolId
    ) {
      return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
    }

    const classLevels = await prisma.classLevel.findMany({
      where: { schoolId },
      include: {
        _count: {
          select: { classes: true },
        },
      },
      orderBy: { sequence: "asc" },
    });

    return NextResponse.json(classLevels);
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.SCHOOL_READ],
  }
);

export const POST = createApiHandler(
  async (request, { session }, t) => {
    let schoolId = session.user.schoolId;
    const body = await request.json();

    if (session.user.role === "SUPER_ADMIN") {
      if (body.schoolId) {
        schoolId = body.schoolId;
      }
    }

    if (!schoolId) {
      return NextResponse.json(translateError(API_ERRORS.INVALID_DATA, t), { status: 400 });
    }

    const validatedData = classLevelSchema.parse(body);

    // Check if code already exists
    const existing = await prisma.classLevel.findFirst({
      where: { schoolId, code: validatedData.code },
    });

    if (existing) {
      return NextResponse.json(translateError(API_ERRORS.ALREADY_EXISTS("Niveau"), t), { status: 400 });
    }

    const classLevel = await prisma.classLevel.create({
      data: {
        schoolId,
        name: validatedData.name,
        code: validatedData.code,
        level: validatedData.level,
        sequence: validatedData.sequence,
      },
    });

    return NextResponse.json(classLevel, { status: 201 });
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.SCHOOL_UPDATE],
  }
);
