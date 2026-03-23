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

const allergySchema = z.object({
  allergen: z.string(),
  severity: z.string(),
  reaction: z.string().optional(),
  treatment: z.string().optional(),
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
    const validatedData = allergySchema.parse(body);

    const allergy = await prisma.allergy.create({
      data: {
        medicalRecordId: id,
        ...validatedData,
      },
    });

    return NextResponse.json(allergy, { status: 201 });
  } catch (error) {
    if (isZodError(error)) {
      return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
    }
    logger.error(" creating allergy:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
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
    const allergyId = searchParams.get("allergyId");

    if (!allergyId) {
      return NextResponse.json({ error: "allergyId requis" }, { status: 400 });
    }

    const allergy = await prisma.allergy.findUnique({
      where: { id: allergyId },
      select: { id: true, medicalRecordId: true },
    });

    if (!allergy || allergy.medicalRecordId !== id) {
      return NextResponse.json({ error: "Allergie non trouvée" }, { status: 404 });
    }

    await prisma.allergy.delete({ where: { id: allergyId } });
    return NextResponse.json({ message: "Allergie supprimée" });
  } catch (error) {
    logger.error(" deleting allergy:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
