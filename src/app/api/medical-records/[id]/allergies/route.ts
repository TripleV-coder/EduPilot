import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

const allergySchema = z.object({
  allergen: z.string(),
  severity: z.string(),
  reaction: z.string().optional(),
  treatment: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = allergySchema.parse(body);

    const allergy = await prisma.allergy.create({
      data: {
        medicalRecordId: params.id,
        ...validatedData,
      },
    });

    return NextResponse.json(allergy, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
    }
    logger.error(" creating allergy:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params: _params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const allergyId = searchParams.get("allergyId");

    if (!allergyId) {
      return NextResponse.json({ error: "allergyId requis" }, { status: 400 });
    }

    await prisma.allergy.delete({ where: { id: allergyId } });
    return NextResponse.json({ message: "Allergie supprimée" });
  } catch (error) {
    logger.error(" deleting allergy:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
