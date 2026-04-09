import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createApiHandler, isValidCuid } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().min(1).max(30).optional(),
  description: z.string().max(500).nullable().optional(),
  color: z.string().max(30).nullable().optional(),
  icon: z.string().max(50).nullable().optional(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/subject-categories/[id]
 */
export const GET = createApiHandler(
  async (_request, { session, params }) => {
    const { id } = await params;
    if (!isValidCuid(id)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }
    const schoolId = getActiveSchoolId(session);

    const category = await prisma.subjectCategory.findFirst({
      where: { id, schoolId },
    });

    if (!category) {
      return NextResponse.json({ error: "Catégorie non trouvée" }, { status: 404 });
    }

    return NextResponse.json(category);
  },
  { requireAuth: true }
);

/**
 * PATCH /api/subject-categories/[id]
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

    const existing = await prisma.subjectCategory.findFirst({
      where: { id, schoolId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Catégorie non trouvée" }, { status: 404 });
    }

    const body = await request.json();
    const data = updateSchema.parse(body);

    if (data.code && data.code !== existing.code) {
      const dup = await prisma.subjectCategory.findUnique({
        where: { schoolId_code: { schoolId, code: data.code } },
      });
      if (dup) {
        return NextResponse.json({ error: "Ce code de catégorie existe déjà" }, { status: 409 });
      }
    }

    const updated = await prisma.subjectCategory.update({
      where: { id },
      data,
    });

    return NextResponse.json(updated);
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"],
  }
);

/**
 * DELETE /api/subject-categories/[id]
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

    const existing = await prisma.subjectCategory.findFirst({
      where: { id, schoolId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Catégorie non trouvée" }, { status: 404 });
    }

    await prisma.subjectCategory.delete({ where: { id } });

    return NextResponse.json({ success: true });
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"],
  }
);
