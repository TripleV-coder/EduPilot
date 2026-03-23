import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import {
  HEALTH_CONTACT_WRITE_ROLES,
  HEALTH_READ_ROLES,
  ensureEmergencyContactHealthAccess,
  ensureMedicalRecordHealthAccess,
  ensureStudentHealthAccess,
  getOwnStudentProfile,
  getParentStudentIds,
  requireHealthRole,
} from "@/lib/health/access";

const emergencyContactSchema = z.object({
  medicalRecordId: z.string().cuid(),
  name: z.string().min(1, "Le nom est requis"),
  relationship: z.string().min(1, "Le lien avec l'élève est requis"),
  phone: z.string().min(1, "Le téléphone est requis"),
  alternatePhone: z.string().optional(),
  address: z.string().optional(),
  isPrimary: z.boolean().default(false),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const roleError = requireHealthRole(session, HEALTH_READ_ROLES);
    if (roleError) return roleError;

    const { searchParams } = new URL(request.url);
    const medicalRecordId = searchParams.get("medicalRecordId");
    const studentId = searchParams.get("studentId");
    const where: Prisma.EmergencyContactWhereInput = {};

    if (medicalRecordId) {
      const access = await ensureMedicalRecordHealthAccess(session, medicalRecordId);
      if ("response" in access) return access.response;
      where.medicalRecordId = medicalRecordId;
    } else if (studentId) {
      const access = await ensureStudentHealthAccess(session, studentId);
      if ("response" in access) return access.response;
      where.medicalRecord = { studentId };
    } else if (session!.user.role === "PARENT") {
      const childIds = await getParentStudentIds(session!.user.id);
      where.medicalRecord = { studentId: { in: childIds } };
    } else if (session!.user.role === "STUDENT") {
      const ownStudentProfile = await getOwnStudentProfile(session!.user.id);
      if (!ownStudentProfile) {
        return NextResponse.json({ error: "Profil étudiant non trouvé" }, { status: 404 });
      }
      where.medicalRecord = { studentId: ownStudentProfile.id };
    } else if (session!.user.role !== "SUPER_ADMIN") {
      where.medicalRecord = { student: { schoolId: session!.user.schoolId! } };
    }

    const emergencyContacts = await prisma.emergencyContact.findMany({
      where,
      include: {
        medicalRecord: {
          include: {
            student: {
              include: {
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ emergencyContacts });
  } catch (error) {
    logger.error("Error fetching emergency contacts", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des contacts d'urgence" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const roleError = requireHealthRole(session, HEALTH_CONTACT_WRITE_ROLES);
    if (roleError) return roleError;

    const body = await request.json();
    const validatedData = emergencyContactSchema.parse(body);

    const access = await ensureMedicalRecordHealthAccess(session, validatedData.medicalRecordId);
    if ("response" in access) return access.response;

    if (validatedData.isPrimary) {
      await prisma.emergencyContact.updateMany({
        where: { medicalRecordId: validatedData.medicalRecordId },
        data: { isPrimary: false },
      });
    }

    const existingContact = await prisma.emergencyContact.findFirst({
      where: {
        medicalRecordId: validatedData.medicalRecordId,
        name: validatedData.name,
        phone: validatedData.phone,
      },
    });

    if (existingContact) {
      return NextResponse.json({ error: "Ce contact existe déjà" }, { status: 409 });
    }

    const emergencyContact = await prisma.emergencyContact.create({
      data: validatedData,
      include: {
        medicalRecord: {
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session!.user.id,
        action: "CREATE",
        entity: "EmergencyContact",
        entityId: emergencyContact.id,
        newValues: { medicalRecordId: validatedData.medicalRecordId, name: validatedData.name },
      },
    });

    logger.info("Emergency contact created", {
      contactId: emergencyContact.id,
      medicalRecordId: validatedData.medicalRecordId,
    });

    return NextResponse.json({ emergencyContact }, { status: 201 });
  } catch (error) {
    if (isZodError(error)) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }

    logger.error("Error creating emergency contact", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la création du contact d'urgence" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    const roleError = requireHealthRole(session, HEALTH_CONTACT_WRITE_ROLES);
    if (roleError) return roleError;

    const body = await request.json();
    const { id, medicalRecordId: _medicalRecordId, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    const access = await ensureEmergencyContactHealthAccess(session, id);
    if ("response" in access) return access.response;

    if (updateData.isPrimary) {
      await prisma.emergencyContact.updateMany({
        where: {
          medicalRecordId: access.emergencyContact.medicalRecordId,
          id: { not: id },
        },
        data: { isPrimary: false },
      });
    }

    const emergencyContact = await prisma.emergencyContact.update({
      where: { id },
      data: updateData,
      include: {
        medicalRecord: {
          include: {
            student: {
              include: {
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session!.user.id,
        action: "UPDATE",
        entity: "EmergencyContact",
        entityId: id,
        newValues: updateData,
      },
    });

    logger.info("Emergency contact updated", { contactId: id });

    return NextResponse.json({ emergencyContact });
  } catch (error) {
    if (isZodError(error)) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }

    logger.error("Error updating emergency contact", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du contact d'urgence" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    const roleError = requireHealthRole(session, HEALTH_CONTACT_WRITE_ROLES);
    if (roleError) return roleError;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    const access = await ensureEmergencyContactHealthAccess(session, id);
    if ("response" in access) return access.response;

    if (access.emergencyContact.isPrimary) {
      const contactCount = await prisma.emergencyContact.count({
        where: { medicalRecordId: access.emergencyContact.medicalRecordId },
      });

      if (contactCount <= 1) {
        return NextResponse.json(
          { error: "Impossible de supprimer le seul contact d'urgence" },
          { status: 400 }
        );
      }
    }

    await prisma.emergencyContact.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        userId: session!.user.id,
        action: "DELETE",
        entity: "EmergencyContact",
        entityId: id,
      },
    });

    logger.info("Emergency contact deleted", { contactId: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Error deleting emergency contact", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du contact d'urgence" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    const roleError = requireHealthRole(session, HEALTH_CONTACT_WRITE_ROLES);
    if (roleError) return roleError;

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    const access = await ensureEmergencyContactHealthAccess(session, id);
    if ("response" in access) return access.response;

    await prisma.$transaction([
      prisma.emergencyContact.updateMany({
        where: {
          medicalRecordId: access.emergencyContact.medicalRecordId,
          id: { not: id },
        },
        data: { isPrimary: false },
      }),
      prisma.emergencyContact.update({
        where: { id },
        data: { isPrimary: true },
      }),
    ]);

    await prisma.auditLog.create({
      data: {
        userId: session!.user.id,
        action: "UPDATE",
        entity: "EmergencyContact",
        entityId: id,
        newValues: { isPrimary: true },
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Error setting primary emergency contact", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du contact principal" },
      { status: 500 }
    );
  }
}
