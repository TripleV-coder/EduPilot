import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { createApiHandler, isValidCuid } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { z } from "zod";

const updateSchema = z.object({
  category: z.string().min(1).max(100).optional(),
  code: z.string().min(1).max(50).optional(),
  label: z.string().min(1).max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

/**
 * GET /api/config-options/[id]
 */
export const GET = createApiHandler(
  async (_request, { session, params }) => {
    const { id } = await params;
    if (!isValidCuid(id)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }
    const schoolId = getActiveSchoolId(session);

    const option = await prisma.configOption.findFirst({
      where: { id, schoolId },
    });
    if (!option) {
      return NextResponse.json({ error: "Option non trouvée" }, { status: 404 });
    }

    return NextResponse.json(option);
  },
  { requireAuth: true }
);

/**
 * PATCH /api/config-options/[id]
 */
export const PATCH = createApiHandler(
  async (request, { session, params }) => {
    const { id } = await params;
    if (!isValidCuid(id)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }
    const schoolId = getActiveSchoolId(session);
    if (!schoolId) {
      return NextResponse.json({ error: "Aucun établissement actif" }, { status: 400 });
    }

    const existing = await prisma.configOption.findFirst({
      where: { id, schoolId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Option non trouvée" }, { status: 404 });
    }

    const body = await request.json();
    const data = updateSchema.parse(body);

    const newCategory = data.category ?? existing.category;
    const newCode = data.code ?? existing.code;
    if (newCategory !== existing.category || newCode !== existing.code) {
      const dup = await prisma.configOption.findUnique({
        where: {
          schoolId_category_code: {
            schoolId,
            category: newCategory,
            code: newCode,
          },
        },
      });
      if (dup && dup.id !== id) {
        return NextResponse.json({ error: "Cette combinaison catégorie/code existe déjà" }, { status: 409 });
      }
    }

    const updateData: Prisma.ConfigOptionUpdateInput = {
      ...data,
      metadata:
        data.metadata === undefined
          ? undefined
          : data.metadata === null
            ? Prisma.JsonNull
            : (data.metadata as Prisma.InputJsonValue),
    };

    const updated = await prisma.configOption.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json(updated);
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
  }
);

/**
 * DELETE /api/config-options/[id]
 */
export const DELETE = createApiHandler(
  async (_request, { session, params }) => {
    const { id } = await params;
    if (!isValidCuid(id)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }
    const schoolId = getActiveSchoolId(session);
    if (!schoolId) {
      return NextResponse.json({ error: "Aucun établissement actif" }, { status: 400 });
    }

    const existing = await prisma.configOption.findFirst({
      where: { id, schoolId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Option non trouvée" }, { status: 404 });
    }

    await prisma.configOption.delete({ where: { id } });

    return NextResponse.json({ success: true });
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"],
  }
);
