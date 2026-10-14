import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isZodError } from "@/lib/is-zod-error";
import { createApiHandler } from "@/lib/api/api-helpers";
import { canAccessSchool } from "@/lib/api/tenant-isolation";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

const evaluationTypeUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  code: z.string().min(1).max(10).optional(),
  weight: z.coerce.number().min(0).max(10).optional(),
  maxCount: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional(),
  category: z.enum(["INTERROGATION", "DEVOIR", "COMPOSITION", "COMPETENCE"]).optional(),
});

export const GET = createApiHandler(async (request, context) => {
  try {
    const { id } = await context.params;
    const session = context.session;

    const evaluationType = await prisma.evaluationType.findUnique({
      where: { id },
      include: {
        evaluations: {
          include: {
            classSubject: {
              include: {
                class: true,
                subject: true,
              },
            },
          },
          take: 10,
        },
      },
    });

    if (!evaluationType) {
      return NextResponse.json({ error: "Type d'évaluation non trouvé" }, { status: 404 });
    }

    if (
      session.user.role !== "SUPER_ADMIN" &&
      !canAccessSchool(session, evaluationType.schoolId)
    ) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    return NextResponse.json(evaluationType);
  } catch (error) {
    logger.error(" fetching evaluation type:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du type d'évaluation" },
      { status: 500 }
    );
  }
});

export const PATCH = createApiHandler(
  async (request, context) => {
  try {
    const { id } = await context.params;
    const session = context.session;

    const existingType = await prisma.evaluationType.findUnique({
      where: { id },
    });

    if (!existingType) {
      return NextResponse.json({ error: "Type d'évaluation non trouvé" }, { status: 404 });
    }

    if (
      session.user.role !== "SUPER_ADMIN" &&
      !canAccessSchool(session, existingType.schoolId)
    ) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = evaluationTypeUpdateSchema.parse(body);

    // Le rôle du type dans la moyenne (et son code, qui sert à le reconnaître)
    // ne change plus une fois utilisé dans une période dont le conseil est
    // validé : les moyennes figées du bulletin ne doivent jamais bouger
    const roleChanges =
      (validatedData.category !== undefined && validatedData.category !== existingType.category) ||
      (validatedData.code !== undefined && validatedData.code !== existingType.code);
    if (roleChanges) {
      const frozenUse = await prisma.evaluation.findFirst({
        where: {
          typeId: id,
          // Prudent : toute période ayant au moins un conseil validé
          period: { councils: { some: {} } },
        },
        select: { id: true },
      });
      if (frozenUse) {
        return NextResponse.json(
          {
            error:
              "Ce type a déjà servi dans une période dont le conseil de classe est validé : son rôle dans la moyenne ne peut plus changer. Créez un nouveau type pour la suite.",
            code: "EVALUATION_TYPE_FROZEN",
          },
          { status: 409 }
        );
      }
    }

    const updatedType = await prisma.$transaction(async (tx) => {
      const updated = await tx.evaluationType.update({
        where: { id },
        data: validatedData,
      });
      if (roleChanges) {
        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            schoolId: existingType.schoolId,
            action: "EVALUATION_TYPE_RULE_CHANGED",
            entity: "EvaluationType",
            entityId: id,
            oldValues: { code: existingType.code, category: existingType.category },
            newValues: { code: updated.code, category: updated.category },
          },
        });
      }
      return updated;
    });

    return NextResponse.json(updatedType);
  } catch (error: unknown) {
    logger.error(" updating evaluation type:", error as Error);
    if (isZodError(error)) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du type d'évaluation" },
      { status: 500 }
    );
  }
  },
  { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"] },
);

export const DELETE = createApiHandler(
  async (request, context) => {
  try {
    const { id } = await context.params;
    const session = context.session;

    const existingType = await prisma.evaluationType.findUnique({
      where: { id },
    });

    if (!existingType) {
      return NextResponse.json({ error: "Type d'évaluation non trouvé" }, { status: 404 });
    }

    if (
      session.user.role !== "SUPER_ADMIN" &&
      !canAccessSchool(session, existingType.schoolId)
    ) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    await prisma.evaluationType.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(" deleting evaluation type:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du type d'évaluation" },
      { status: 500 }
    );
  }
  },
  { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] },
);
