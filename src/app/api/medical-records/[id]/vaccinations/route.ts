import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import {
  HEALTH_STAFF_ROLES,
  ensureMedicalRecordHealthAccess,
  requireHealthRole,
} from "@/lib/health/access";

const vaccinationSchema = z.object({
  vaccineName: z.string().min(1, "Nom du vaccin requis"),
  dateGiven: z.string().datetime(),
  nextDueDate: z.string().datetime().optional(),
  administeredBy: z.string().optional(),
  batchNumber: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    const roleError = requireHealthRole(session, HEALTH_STAFF_ROLES);
    if (roleError) return roleError;

    const access = await ensureMedicalRecordHealthAccess(session, id);
    if ("response" in access) return access.response;

    const body = await request.json();
    const validatedData = vaccinationSchema.parse(body);

    const vaccination = await prisma.vaccination.create({
      data: {
        medicalRecordId: id,
        vaccineName: validatedData.vaccineName,
        dateGiven: new Date(validatedData.dateGiven),
        nextDueDate: validatedData.nextDueDate ? new Date(validatedData.nextDueDate) : null,
        administeredBy: validatedData.administeredBy,
        batchNumber: validatedData.batchNumber,
      },
    });

    return NextResponse.json(vaccination, { status: 201 });
  } catch (error) {
    if (isZodError(error)) {
      return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
    }
    logger.error(" creating vaccination:", error as Error);
    return NextResponse.json({ error: "Erreur lors de la création" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    const roleError = requireHealthRole(session, HEALTH_STAFF_ROLES);
    if (roleError) return roleError;

    const access = await ensureMedicalRecordHealthAccess(session, id);
    if ("response" in access) return access.response;

    const { searchParams } = new URL(request.url);
    const vaccinationId = searchParams.get("vaccinationId");

    if (!vaccinationId) {
      return NextResponse.json({ error: "vaccinationId requis" }, { status: 400 });
    }

    const vaccination = await prisma.vaccination.findUnique({
      where: { id: vaccinationId },
      select: { id: true, medicalRecordId: true },
    });

    if (!vaccination || vaccination.medicalRecordId !== id) {
      return NextResponse.json({ error: "Vaccination non trouvée" }, { status: 404 });
    }

    await prisma.vaccination.delete({ where: { id: vaccinationId } });
    return NextResponse.json({ message: "Vaccination supprimée" });
  } catch (error) {
    logger.error(" deleting vaccination:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
