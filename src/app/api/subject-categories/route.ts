import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { z } from "zod";

const subjectCategorySchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().min(1).max(30),
  description: z.string().max(500).optional(),
  color: z.string().max(30).optional(),
  icon: z.string().max(50).optional(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/subject-categories
 * List subject categories for the current school
 */
export const GET = createApiHandler(
  async (request, { session }) => {
    const schoolId = getActiveSchoolId(session);
    if (!schoolId) {
      return NextResponse.json({ error: "Aucun établissement actif" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get("activeOnly") !== "false";

    const categories = await prisma.subjectCategory.findMany({
      where: {
        schoolId,
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: { order: "asc" },
    });

    return NextResponse.json(categories);
  },
  { requireAuth: true }
);

/**
 * POST /api/subject-categories
 * Create a subject category
 */
export const POST = createApiHandler(
  async (request, { session }) => {
    const schoolId = getActiveSchoolId(session);
    if (!schoolId) {
      return NextResponse.json({ error: "Aucun établissement actif" }, { status: 400 });
    }

    const body = await request.json();
    const data = subjectCategorySchema.parse(body);

    const existing = await prisma.subjectCategory.findUnique({
      where: { schoolId_code: { schoolId, code: data.code } },
    });
    if (existing) {
      return NextResponse.json({ error: "Ce code de catégorie existe déjà" }, { status: 409 });
    }

    const category = await prisma.subjectCategory.create({
      data: {
        schoolId,
        name: data.name,
        code: data.code,
        description: data.description,
        color: data.color,
        icon: data.icon,
        order: data.order ?? 0,
        isActive: data.isActive ?? true,
      },
    });

    return NextResponse.json(category, { status: 201 });
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"],
  }
);
