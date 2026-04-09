import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { z } from "zod";

const configOptionSchema = z.object({
  category: z.string().min(1).max(100),
  code: z.string().min(1).max(50),
  label: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * GET /api/config-options
 * List config options, optionally filtered by category
 */
export const GET = createApiHandler(
  async (request, { session }) => {
    const schoolId = getActiveSchoolId(session);
    if (!schoolId) {
      return NextResponse.json({ error: "Aucun établissement actif" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const activeOnly = searchParams.get("activeOnly") !== "false";

    const options = await prisma.configOption.findMany({
      where: {
        schoolId,
        ...(category ? { category } : {}),
        ...(activeOnly ? { isActive: true } : {}),
      },
      orderBy: [{ category: "asc" }, { order: "asc" }],
    });

    return NextResponse.json(options);
  },
  { requireAuth: true }
);

/**
 * POST /api/config-options
 * Create a config option
 */
export const POST = createApiHandler(
  async (request, { session }) => {
    const schoolId = getActiveSchoolId(session);
    if (!schoolId) {
      return NextResponse.json({ error: "Aucun établissement actif" }, { status: 400 });
    }

    const body = await request.json();
    const data = configOptionSchema.parse(body);

    const existing = await prisma.configOption.findUnique({
      where: {
        schoolId_category_code: {
          schoolId,
          category: data.category,
          code: data.code,
        },
      },
    });
    if (existing) {
      return NextResponse.json({ error: "Cette option de configuration existe déjà" }, { status: 409 });
    }

    const option = await prisma.configOption.create({
      data: {
        schoolId,
        category: data.category,
        code: data.code,
        label: data.label,
        description: data.description,
        order: data.order ?? 0,
        isActive: data.isActive ?? true,
        metadata: data.metadata as Prisma.InputJsonValue | undefined,
      },
    });

    return NextResponse.json(option, { status: 201 });
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
  }
);
