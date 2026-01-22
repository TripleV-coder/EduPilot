import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { Permission } from "@/lib/rbac/permissions";

// Schema validation for school creation
const schoolSchema = z.object({
  name: z.string().min(3, "Le nom doit contenir au moins 3 caractères"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email invalide").optional(),
  website: z.string().url("URL invalide").optional(),
});

export const GET = createApiHandler(
  async (request, { session }, t) => {
    // Role-based filtering
    let whereClause = {};
    if (session.user.role === "SUPER_ADMIN") {
      // Super admin sees all schools
      whereClause = {};
    } else {
      // Others see only their school
      if (!session.user.schoolId) {
        return NextResponse.json(translateError({ error: "Aucun établissement associé", key: "api.issues.no_school_associated" }, t), { status: 403 });
      }
      whereClause = { id: session.user.schoolId };
    }

    const schools = await prisma.school.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { users: true, classes: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(schools);
  },
  {
    requireAuth: true,
  }
);

export const POST = createApiHandler(
  async (request, _context, _t) => {
    const body = await request.json();
    const validatedData = schoolSchema.parse(body);

    const school = await prisma.school.create({
      data: {
        ...validatedData,
        code: validatedData.name.substring(0, 3).toUpperCase() + "-" + Math.floor(Math.random() * 1000),
        level: "PRIMARY", // Default to PRIMARY, should be configurable
        // Create default academic config
        academicConfigs: {
          create: {
            periodType: "TRIMESTER",
          }
        },
        academicYears: {
          create: {
            name: new Date().getFullYear().toString() + "-" + (new Date().getFullYear() + 1).toString(),
            startDate: new Date(),
            endDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
            isCurrent: true,
            periods: {
              create: [
                { name: "Trimestre 1", type: "TRIMESTER", startDate: new Date(), endDate: new Date(), sequence: 1 },
                { name: "Trimestre 2", type: "TRIMESTER", startDate: new Date(), endDate: new Date(), sequence: 2 },
                { name: "Trimestre 3", type: "TRIMESTER", startDate: new Date(), endDate: new Date(), sequence: 3 },
              ]
            }
          }
        }
      },
      include: {
        academicConfigs: true,
      },
    });

    return NextResponse.json(school, { status: 201 });
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.SCHOOL_CREATE],
  }
);
