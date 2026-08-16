import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { createApiHandler } from "@/lib/api/api-helpers";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { isZodError } from "@/lib/is-zod-error";
import { logger } from "@/lib/utils/logger";
import {
  decodeTemplateSubject,
  embedSlug,
  encodeTemplateSubject,
  extractSlug,
  stripSlugMarker,
} from "@/lib/communication/default-templates";

const patchSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  category: z.string().min(2).max(60).optional(),
  body: z.string().min(5).max(2000).optional(),
  isActive: z.boolean().optional(),
  autoTrigger: z.string().max(200).nullable().optional(),
});

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

/**
 * PATCH /api/communication/templates/[id]
 * Met à jour un modèle de l'école active.
 */
export const PATCH = createApiHandler(
  async (request, { session, params }): Promise<NextResponse> => {
    try {
      const { id } = await params;
      const schoolId = getActiveSchoolId(session);
      if (!schoolId) {
        return NextResponse.json({ error: "Aucun établissement associé", code: "NO_SCHOOL" }, { status: 403 });
      }

      const existing = await prisma.communicationTemplate.findFirst({
        where: { id, schoolId },
      });
      if (!existing) {
        return NextResponse.json({ error: "Modèle introuvable" }, { status: 404 });
      }

      const body = patchSchema.parse(await request.json());
      const currentMeta = decodeTemplateSubject(existing.subject);
      const slug = extractSlug(existing.content) ?? existing.id;
      const nextCategory = body.category ?? currentMeta.category;
      const nextTrigger =
        body.autoTrigger === null
          ? undefined
          : body.autoTrigger !== undefined
            ? body.autoTrigger
            : currentMeta.autoTrigger;

      const updated = await prisma.communicationTemplate.update({
        where: { id },
        data: {
          name: body.name ?? existing.name,
          isActive: body.isActive ?? existing.isActive,
          subject: encodeTemplateSubject(nextCategory, nextTrigger),
          content:
            body.body !== undefined
              ? embedSlug(body.body, slug)
              : existing.content,
        },
      });

      return NextResponse.json({ template: serializeTemplate(updated) });
    } catch (error) {
      if (isZodError(error)) {
        return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
      }
      logger.error("updating communication template", error as Error);
      return NextResponse.json({ error: "Erreur lors de la mise à jour" }, { status: 500 });
    }
  },
  { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] }
);
