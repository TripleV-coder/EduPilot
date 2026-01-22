import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { feeSchema } from "@/lib/validations/finance";
import { logger } from "@/lib/utils/logger";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const fee = await prisma.fee.findUnique({
      where: { id },
      include: {
        academicYear: true,
        payments: {
          include: {
            student: {
              include: {
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
          orderBy: { paidAt: "desc" },
        },
      },
    });

    if (!fee) {
      return NextResponse.json({ error: "Frais non trouvé" }, { status: 404 });
    }

    if (
      session.user.role !== "SUPER_ADMIN" &&
      fee.schoolId !== session.user.schoolId
    ) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    return NextResponse.json(fee);
  } catch (error) {
    logger.error(" fetching fee:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du frais" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"];
    if (!allowedRoles.includes(session.user.role as string)) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const existingFee = await prisma.fee.findUnique({
      where: { id },
    });

    if (!existingFee) {
      return NextResponse.json({ error: "Frais non trouvé" }, { status: 404 });
    }

    if (
      session.user.role !== "SUPER_ADMIN" &&
      existingFee.schoolId !== session.user.schoolId
    ) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = feeSchema.partial().parse(body);

    const updatedFee = await prisma.fee.update({
      where: { id },
      data: validatedData,
    });

    return NextResponse.json(updatedFee);
  } catch (error: unknown) {
    logger.error(" updating fee:", error as Error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du frais" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];
    if (!allowedRoles.includes(session.user.role as string)) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const existingFee = await prisma.fee.findUnique({
      where: { id },
    });

    if (!existingFee) {
      return NextResponse.json({ error: "Frais non trouvé" }, { status: 404 });
    }

    if (
      session.user.role !== "SUPER_ADMIN" &&
      existingFee.schoolId !== session.user.schoolId
    ) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    await prisma.fee.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(" deleting fee:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du frais" },
      { status: 500 }
    );
  }
}
