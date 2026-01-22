import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { userSchema } from "@/lib/validations/user";
import type { UserWhereFilter } from "@/lib/types/api";
import type { UserRole } from "@prisma/client";
import { logger } from "@/lib/utils/logger";
import { sanitizeRequestBody, sanitizePlainText } from "@/lib/sanitize";
import { createApiHandler, getPaginationParams, createPaginatedResponse, translateError } from "@/lib/api/api-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";

export const GET = createApiHandler(
  async (request, { session }) => {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get("role");
    const schoolId = searchParams.get("schoolId");
    const search = searchParams.get("search");

    // Pagination parameters
    const { page, limit, skip } = getPaginationParams(request, { defaultLimit: 20, maxLimit: 100 });

    // Build where clause based on user role with proper typing
    const where: UserWhereFilter = {};

    if (session.user.role === "SUPER_ADMIN") {
      if (schoolId) where.schoolId = schoolId;
      if (role) where.role = role as UserRole;
    } else {
      // Non-super admins can only see users from their school
      where.schoolId = session.user.schoolId;
      if (role) where.role = role as UserRole;
    }

    // Search filter
    if (search) {
      const sanitizedSearch = sanitizePlainText(search);
      where.OR = [
        { firstName: { contains: sanitizedSearch, mode: "insensitive" } },
        { lastName: { contains: sanitizedSearch, mode: "insensitive" } },
        { email: { contains: sanitizedSearch, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          isActive: true,
          schoolId: true,
          createdAt: true,
          school: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          teacherProfile: {
            select: {
              id: true,
              matricule: true,
              specialization: true,
            },
          },
          studentProfile: {
            select: {
              id: true,
              matricule: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return createPaginatedResponse(users, page, limit, total);
  },
  {
    requireAuth: true,
  }
);

export const POST = createApiHandler(
  async (request, { session }, t) => {
    // Parse and sanitize body
    const body = await request.json();
    const sanitizedBody = sanitizeRequestBody(body);
    const validatedData = userSchema.parse(sanitizedBody);

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      return NextResponse.json(
        translateError(API_ERRORS.ALREADY_EXISTS("Un utilisateur avec cet email"), t),
        { status: 400 }
      );
    }

    // Non-super admins can only create users for their school
    if (session.user.role !== "SUPER_ADMIN") {
      validatedData.schoolId = session.user.schoolId;
    }

    // Password is required for new users
    if (!validatedData.password) {
      return NextResponse.json(
        { ...translateError(API_ERRORS.INVALID_DATA, t), error: t("api.issues.password_required") || "Le mot de passe est obligatoire" },
        // Ideally should have a key for password required in i18n
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 12);

    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        phone: validatedData.phone,
        role: validatedData.role,
        schoolId: validatedData.schoolId,
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        isActive: true,
        schoolId: true,
        createdAt: true,
      },
    });

    logger.info("User created", { userId: user.id, createdBy: session.user.id });
    return NextResponse.json(user, { status: 201 });
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"],
  }
);
