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

const emergencyContactSchema = z.object({
  name: z.string().min(1, "Nom requis"),
  relationship: z.string().min(1, "Lien de parenté requis"),
  phone: z.string().min(1, "Téléphone requis"),
  alternatePhone: z.string().optional(),
  address: z.string().optional(),
  isPrimary: z.boolean().default(false),
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
    const validatedData = emergencyContactSchema.parse(body);

    if (validatedData.isPrimary) {
      await prisma.emergencyContact.updateMany({
        where: { medicalRecordId: id, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const contact = await prisma.emergencyContact.create({
      data: {
        medicalRecordId: id,
        ...validatedData,
      },
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    if (isZodError(error)) {
      return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
    }
    logger.error(" creating emergency contact:", error as Error);
    return NextResponse.json({ error: "Erreur lors de la création" }, { status: 500 });
  }
}

export async function PUT(
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
    const contactId = searchParams.get("contactId");

    if (!contactId) {
      return NextResponse.json({ error: "contactId requis" }, { status: 400 });
    }

    const existingContact = await prisma.emergencyContact.findUnique({
      where: { id: contactId },
      select: { id: true, medicalRecordId: true },
    });

    if (!existingContact || existingContact.medicalRecordId !== id) {
      return NextResponse.json({ error: "Contact non trouvé" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = emergencyContactSchema.parse(body);

    if (validatedData.isPrimary) {
      await prisma.emergencyContact.updateMany({
        where: {
          medicalRecordId: id,
          id: { not: contactId },
          isPrimary: true,
        },
        data: { isPrimary: false },
      });
    }

    const contact = await prisma.emergencyContact.update({
      where: { id: contactId },
      data: validatedData,
    });

    return NextResponse.json(contact);
  } catch (error) {
    if (isZodError(error)) {
      return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
    }
    logger.error(" updating emergency contact:", error as Error);
    return NextResponse.json({ error: "Erreur lors de la mise à jour" }, { status: 500 });
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
    const contactId = searchParams.get("contactId");

    if (!contactId) {
      return NextResponse.json({ error: "contactId requis" }, { status: 400 });
    }

    const contact = await prisma.emergencyContact.findUnique({
      where: { id: contactId },
      select: { id: true, medicalRecordId: true },
    });

    if (!contact || contact.medicalRecordId !== id) {
      return NextResponse.json({ error: "Contact non trouvé" }, { status: 404 });
    }

    await prisma.emergencyContact.delete({ where: { id: contactId } });
    return NextResponse.json({ message: "Contact supprimé" });
  } catch (error) {
    logger.error(" deleting emergency contact:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
