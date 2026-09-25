import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireRoot } from "@/lib/security/require-root";
import { logger } from "@/lib/utils/logger";
import { createApiHandler } from "@/lib/api/api-helpers";

export const dynamic = "force-dynamic";

// Les nombres arrivent parfois en chaînes (formulaires) : on les convertit,
// et un NaN ou une valeur négative est refusé (400) au lieu d'atteindre Prisma.
const intField = z.coerce.number().int().min(0);
const priceField = z.coerce.number().min(0);

const planFields = z.object({
  name: z.string().trim().min(1),
  code: z.string().trim().min(1).transform((c) => c.toUpperCase()),
  description: z.string().trim().nullable().optional(),
  maxStudents: intField.optional(),
  maxTeachers: intField.optional(),
  maxStorageGB: intField.optional(),
  priceMonthly: priceField,
  priceYearly: priceField.optional(),
  features: z.array(z.string().trim().min(1)).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  priceOnRequest: z.boolean().optional(),
});

const updateFields = planFields.partial();

function invalid(error: z.ZodError) {
  return NextResponse.json(
    { error: "Données invalides", details: error.flatten().fieldErrors },
    { status: 400 }
  );
}

/** Un seul plan mis en avant : l'activer sur un plan le retire des autres. */
async function clearOtherFeatured(exceptId?: string) {
  await prisma.subscriptionPlan.updateMany({
    where: { isFeatured: true, ...(exceptId ? { id: { not: exceptId } } : {}) },
    data: { isFeatured: false },
  });
}

export const GET = createApiHandler(
  async (_request, context) => {
    const session = context.session;
    const guard = requireRoot(session, session?.user?.email, session?.user?.id);
    if (guard) return guard;

    try {
      const plans = await prisma.subscriptionPlan.findMany({
        orderBy: { priceMonthly: "asc" },
        include: { _count: { select: { schools: true } } },
      });
      return NextResponse.json({ data: plans });
    } catch (error) {
      logger.error("Error fetching plans", error as Error);
      return NextResponse.json({ error: "Erreur lors de la récupération des plans" }, { status: 500 });
    }
  },
  {},
);

export const POST = createApiHandler(
  async (request, context) => {
    const session = context.session;
    const guard = requireRoot(session, session?.user?.email, session?.user?.id);
    if (guard) return guard;

    try {
      const body = await request.json();
      if (!body?.name || !body?.code || body?.priceMonthly === undefined) {
        return NextResponse.json({ error: "Nom, code et prix requis" }, { status: 400 });
      }
      const parsed = planFields.safeParse(body);
      if (!parsed.success) return invalid(parsed.error);
      const input = parsed.data;

      if (input.isFeatured) await clearOtherFeatured();

      const plan = await prisma.subscriptionPlan.create({
        data: {
          name: input.name,
          code: input.code,
          description: input.description ?? null,
          maxStudents: input.maxStudents ?? 100,
          maxTeachers: input.maxTeachers ?? 10,
          maxStorageGB: input.maxStorageGB ?? 5,
          priceMonthly: input.priceMonthly,
          priceYearly: input.priceYearly ?? input.priceMonthly * 10,
          features: input.features ?? [],
          isActive: input.isActive ?? true,
          isFeatured: input.isFeatured ?? false,
          priceOnRequest: input.priceOnRequest ?? false,
        },
      });

      return NextResponse.json({ data: plan }, { status: 201 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return NextResponse.json({ error: "Un plan avec ce code ou nom existe déjà" }, { status: 400 });
      }
      logger.error("Error creating plan", error as Error);
      return NextResponse.json({ error: "Erreur lors de la création du plan" }, { status: 500 });
    }
  },
  {},
);

export const PATCH = createApiHandler(
  async (request, context) => {
    const session = context.session;
    const guard = requireRoot(session, session?.user?.email, session?.user?.id);
    if (guard) return guard;

    try {
      const body = await request.json();
      const { id, ...rest } = body ?? {};
      if (!id) {
        return NextResponse.json({ error: "ID requis" }, { status: 400 });
      }
      const parsed = updateFields.safeParse(rest);
      if (!parsed.success) return invalid(parsed.error);
      const data = parsed.data;

      if (data.isFeatured) await clearOtherFeatured(id);

      const plan = await prisma.subscriptionPlan.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.code !== undefined && { code: data.code }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.maxStudents !== undefined && { maxStudents: data.maxStudents }),
          ...(data.maxTeachers !== undefined && { maxTeachers: data.maxTeachers }),
          ...(data.maxStorageGB !== undefined && { maxStorageGB: data.maxStorageGB }),
          ...(data.priceMonthly !== undefined && { priceMonthly: data.priceMonthly }),
          ...(data.priceYearly !== undefined && { priceYearly: data.priceYearly }),
          ...(data.features !== undefined && { features: data.features }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
          ...(data.isFeatured !== undefined && { isFeatured: data.isFeatured }),
          ...(data.priceOnRequest !== undefined && { priceOnRequest: data.priceOnRequest }),
        },
      });

      return NextResponse.json({ data: plan });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          return NextResponse.json({ error: "Un plan avec ce code ou nom existe déjà" }, { status: 400 });
        }
        if (error.code === "P2025") {
          return NextResponse.json({ error: "Plan introuvable" }, { status: 404 });
        }
      }
      logger.error("Error updating plan", error as Error);
      return NextResponse.json({ error: "Erreur lors de la mise à jour du plan" }, { status: 500 });
    }
  },
  {},
);

export const DELETE = createApiHandler(
  async (request, context) => {
    const session = context.session;
    const guard = requireRoot(session, session?.user?.email, session?.user?.id);
    if (guard) return guard;

    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    try {
      // Un plan encore souscrit ne se supprime pas : ces écoles perdraient
      // leur formule. On le désactive à la place (retiré de la vente).
      const subscribed = await prisma.school.count({ where: { planId: id } });
      if (subscribed > 0) {
        return NextResponse.json(
          {
            error: `Ce plan est utilisé par ${subscribed} établissement(s). Désactivez-le plutôt que de le supprimer.`,
            code: "PLAN_IN_USE",
            schools: subscribed,
          },
          { status: 409 }
        );
      }
      await prisma.subscriptionPlan.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
        return NextResponse.json({ error: "Plan introuvable" }, { status: 404 });
      }
      logger.error("Error deleting plan", error as Error);
      return NextResponse.json({ error: "Erreur lors de la suppression du plan" }, { status: 500 });
    }
  },
  {},
);
