import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { subjectSchema } from "@/lib/validations/subject";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";
import { Permission } from "@/lib/rbac/permissions";

export const GET = createApiHandler(
  async (request, { session }, t) => {
    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get("schoolId") || session.user.schoolId;

    if (!schoolId) {
      // Ideally we should allow SUPER_ADMIN to list all? or restrict?
      // Current logic mimics old one: schoolId required.
      if (session.user.role === "SUPER_ADMIN") {
        // If no schoolId provided, maybe return all? But scheme is multi-tenant.
        // Let's stick to strict checking for now.
        return NextResponse.json(translateError(API_ERRORS.INVALID_DATA, t), { status: 400 });
      }
      return NextResponse.json(translateError({ error: "Aucun établissement associé", key: "api.issues.no_school_associated" }, t), { status: 400 });
    }

    // Security check
    if (session.user.role !== "SUPER_ADMIN" && schoolId !== session.user.schoolId) {
      return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
    }

    const subjects = await prisma.subject.findMany({
      where: { schoolId, isActive: true },
      include: {
        _count: {
          select: { classSubjects: true },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(subjects);
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.SUBJECT_READ],
  }
);

export const POST = createApiHandler(
  async (request, { session }, t) => {
    // Determine schoolId with proper validation
    let schoolId = session.user.schoolId;
    const body = await request.json();

    if (session.user.role === "SUPER_ADMIN" && body.schoolId) {
      schoolId = body.schoolId;
    }

    if (!schoolId) {
      return NextResponse.json(translateError({ error: "Établissement requis", key: "api.issues.school_required" }, t), { status: 400 });
    }

    const validatedData = subjectSchema.parse(body);

    // Check if subject code already exists
    const existing = await prisma.subject.findFirst({
      where: { schoolId, code: validatedData.code },
    });

    if (existing) {
      return NextResponse.json(
        translateError(API_ERRORS.ALREADY_EXISTS("Une matière avec ce code"), t),
        { status: 400 }
      );
    }

    const subject = await prisma.subject.create({
      data: {
        schoolId,
        name: validatedData.name,
        code: validatedData.code,
        category: validatedData.category,
      },
    });

    return NextResponse.json(subject, { status: 201 });
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.SUBJECT_CREATE],
  }
);
