import { Session } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { hasValidRootSession, isRootUserEmail } from "@/lib/security/root-access";
import { logger } from "@/lib/utils/logger";

import { Prisma } from "@prisma/client";

function requireRoot(session: Session | null, userEmail?: string | null, userId?: string | null) {
  if (!userId || !userEmail) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }
  if (!isRootUserEmail(userEmail) || !hasValidRootSession(session)) {
    return NextResponse.json({ error: "Accès root refusé" }, { status: 403 });
  }
  return null;
}

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  const guard = requireRoot(session, session?.user?.email, session?.user?.id);
  if (guard) return guard;

  try {
    const plans = await prisma.subscriptionPlan.findMany({
      orderBy: { priceMonthly: "asc" },
    });

    return NextResponse.json({ data: plans });
  } catch (error) {
    logger.error("Error fetching plans", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des plans" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  const guard = requireRoot(session, session?.user?.email, session?.user?.id);
  if (guard) return guard;

  try {
    const body = await request.json();
    
    if (!body.name || !body.code || body.priceMonthly === undefined) {
      return NextResponse.json({ error: "Nom, code et prix requis" }, { status: 400 });
    }

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name: body.name,
        code: body.code.toUpperCase(),
        description: body.description,
        maxStudents: parseInt(body.maxStudents) || 100,
        maxTeachers: parseInt(body.maxTeachers) || 10,
        maxStorageGB: parseInt(body.maxStorageGB) || 5,
        priceMonthly: parseFloat(body.priceMonthly),
        priceYearly: parseFloat(body.priceYearly) || parseFloat(body.priceMonthly) * 10,
        features: Array.isArray(body.features) ? body.features : [],
        isActive: body.isActive !== undefined ? body.isActive : true,
      },
    });

    return NextResponse.json({ data: plan }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json({ error: "Un plan avec ce code ou nom existe déjà" }, { status: 400 });
      }
    }
    logger.error("Error creating plan", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du plan" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  const guard = requireRoot(session, session?.user?.email, session?.user?.id);
  if (guard) return guard;

  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    const plan = await prisma.subscriptionPlan.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.code && { code: data.code.toUpperCase() }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.maxStudents !== undefined && { maxStudents: parseInt(data.maxStudents) }),
        ...(data.maxTeachers !== undefined && { maxTeachers: parseInt(data.maxTeachers) }),
        ...(data.maxStorageGB !== undefined && { maxStorageGB: parseInt(data.maxStorageGB) }),
        ...(data.priceMonthly !== undefined && { priceMonthly: parseFloat(data.priceMonthly) }),
        ...(data.priceYearly !== undefined && { priceYearly: parseFloat(data.priceYearly) }),
        ...(data.features !== undefined && { features: data.features }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    return NextResponse.json({ data: plan });
  } catch (error) {
    logger.error("Error updating plan", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du plan" },
      { status: 500 }
    );
  }
}
