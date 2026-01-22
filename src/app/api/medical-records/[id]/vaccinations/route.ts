import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

const vaccinationSchema = z.object({
  vaccineName: z.string().min(1, "Nom du vaccin requis"),
  dateGiven: z.string().datetime(),
  nextDueDate: z.string().datetime().optional(),
  administeredBy: z.string().optional(),
  batchNumber: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "NURSE"];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = vaccinationSchema.parse(body);

    const vaccination = await prisma.vaccination.create({
      data: {
        medicalRecordId: params.id,
        ...validatedData,
      },
    });

    return NextResponse.json(vaccination, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
    }
    logger.error(" creating vaccination:", error as Error);
    return NextResponse.json({ error: "Erreur lors de la création" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params: _params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "NURSE"];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const vaccinationId = searchParams.get("vaccinationId");

    if (!vaccinationId) {
      return NextResponse.json({ error: "vaccinationId requis" }, { status: 400 });
    }

    await prisma.vaccination.delete({ where: { id: vaccinationId } });
    return NextResponse.json({ message: "Vaccination supprimée" });
  } catch (error) {
    logger.error(" deleting vaccination:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
