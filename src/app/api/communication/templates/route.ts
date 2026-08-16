import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { isZodError } from "@/lib/is-zod-error";
import { logger } from "@/lib/utils/logger";
import {
  DEFAULT_COMMUNICATION_TEMPLATES,
  decodeTemplateSubject,
  embedSlug,
  encodeTemplateSubject,
  extractSlug,
  stripSlugMarker,
} from "@/lib/communication/default-templates";

const STAFF_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "STAFF"] as const;

function serializeTemplate(row: {
  id: string;
  name: string;
  subject: string | null;
  content: string;
  isActive: boolean;
  language: string;
  updatedAt: Date;
}) {
  const { category, autoTrigger } = decodeTemplateSubject(row.subject);
  return {
    id: row.id,
    slug: extractSlug(row.content),
    name: row.name,
    category,
    autoTrigger,
    body: stripSlugMarker(row.content),
    isActive: row.isActive,
    language: row.language,
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function ensureSchoolTemplates(schoolId: string) {
  const count = await prisma.communicationTemplate.count({ where: { schoolId } });
  if (count > 0) return;

  await prisma.communicationTemplate.createMany({
    data: DEFAULT_COMMUNICATION_TEMPLATES.map((tpl) => ({
      schoolId,
      name: tpl.name,
      language: "fr",
      subject: encodeTemplateSubject(tpl.category, tpl.autoTrigger),
      content: embedSlug(tpl.body, tpl.slug),
      isActive: tpl.isActive,
    })),
  });
}

/**
 * GET /api/communication/templates
 * Liste les modèles de l'école active (seed auto si vide).
 */
export const GET = createApiHandler(
  async (_request, { session }) => {
    const schoolId = getActiveSchoolId(session);
    if (!schoolId) {
      return NextResponse.json({ error: "Aucun établissement associé", code: "NO_SCHOOL" }, { status: 403 });
    }

    await ensureSchoolTemplates(schoolId);

    const rows = await prisma.communicationTemplate.findMany({
      where: { schoolId },
      orderBy: [{ name: "asc" }],
    });

    return NextResponse.json({ templates: rows.map(serializeTemplate) });
  },
  { allowedRoles: [...STAFF_ROLES] }
);

const createSchema = z.object({
  name: z.string().min(2).max(120),
  category: z.string().min(2).max(60),
  body: z.string().min(5).max(2000),
  isActive: z.boolean().optional().default(true),
  autoTrigger: z.string().max(200).optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .max(80)
    .optional(),
});

/**
 * POST /api/communication/templates
 * Crée un nouveau modèle pour l'école active.
 */
export const POST = createApiHandler(
  async (request, { session }) => {
    try {
      const schoolId = getActiveSchoolId(session);
      if (!schoolId) {
        return NextResponse.json({ error: "Aucun établissement associé", code: "NO_SCHOOL" }, { status: 403 });
      }

      const body = createSchema.parse(await request.json());
      const slugFromName = body.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80);
      const slug = body.slug || slugFromName || `tpl-${Date.now()}`;

      const created = await prisma.communicationTemplate.create({
        data: {
          schoolId,
          name: body.name,
          language: "fr",
          subject: encodeTemplateSubject(body.category, body.autoTrigger),
          content: embedSlug(body.body, slug),
          isActive: body.isActive,
        },
      });

      return NextResponse.json({ template: serializeTemplate(created) }, { status: 201 });
    } catch (error) {
      if (isZodError(error)) {
        return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
      }
      logger.error("creating communication template", error as Error);
      return NextResponse.json({ error: "Erreur lors de la création" }, { status: 500 });
    }
  },
  { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] }
);
