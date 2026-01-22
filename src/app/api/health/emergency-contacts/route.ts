import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

// Validation schema for emergency contact
const emergencyContactSchema = z.object({
  medicalRecordId: z.string().cuid(),
  name: z.string().min(1, "Le nom est requis"),
  relationship: z.string().min(1, "Le lien avec l'élève est requis"),
  phone: z.string().min(1, "Le téléphone est requis"),
  alternatePhone: z.string().optional(),
  address: z.string().optional(),
  isPrimary: z.boolean().default(false),
});

// GET /api/health/emergency-contacts - Get emergency contacts
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const medicalRecordId = searchParams.get("medicalRecordId");
    const studentId = searchParams.get("studentId");

    // Build where clause
    const where: any = {};

    if (medicalRecordId) {
      where.medicalRecordId = medicalRecordId;
    }

    // If studentId is provided, get the medical record first
    if (studentId) {
      const medicalRecord = await prisma.medicalRecord.findUnique({
        where: { studentId },
      });

      if (medicalRecord) {
        where.medicalRecordId = medicalRecord.id;
      } else {
        return NextResponse.json({ error: "Dossier médical non trouvé" }, { status: 404 });
      }
    }

    // Role-based filtering
    if (session.user.role === "PARENT") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        include: { children: true },
      });

      if (parentProfile) {
        const medicalRecords = await prisma.medicalRecord.findMany({
          where: {
            studentId: { in: parentProfile.children.map((c) => c.studentId) },
          },
          select: { id: true },
        });
        where.medicalRecordId = { in: medicalRecords.map((mr) => mr.id) };
      }
    } else if (session.user.role === "STUDENT") {
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
      });

      if (studentProfile) {
        const medicalRecord = await prisma.medicalRecord.findUnique({
          where: { studentId: studentProfile.id },
        });
        if (medicalRecord) {
          where.medicalRecordId = medicalRecord.id;
        }
      }
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

// POST /api/health/emergency-contacts - Add emergency contact
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Parents can add contacts for their children
    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "SECRETARY", "PARENT"];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = emergencyContactSchema.parse(body);

    // Verify medical record exists
    const medicalRecord = await prisma.medicalRecord.findUnique({
      where: { id: validatedData.medicalRecordId },
      include: {
        student: {
          include: { parentLinks: { select: { parent: { select: { userId: true } } } } },
        },
      },
    });

    if (!medicalRecord) {
      return NextResponse.json({ error: "Dossier médical non trouvé" }, { status: 404 });
    }

    // Parents can only add contacts for their own children
    if (session.user.role === "PARENT") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        include: { children: true },
      });

      const isParent = parentProfile?.children.some(
        (c) => c.studentId === medicalRecord.studentId
      );

      if (!isParent) {
        return NextResponse.json(
          { error: "Vous ne pouvez ajouter des contacts que pour vos propres enfants" },
          { status: 403 }
        );
      }
    }

    // If setting as primary, unset other primary contacts
    if (validatedData.isPrimary) {
      await prisma.emergencyContact.updateMany({
        where: { medicalRecordId: validatedData.medicalRecordId },
        data: { isPrimary: false },
      });
    }

    // Check for duplicate contacts (same name and phone)
    const existingContact = await prisma.emergencyContact.findFirst({
      where: {
        medicalRecordId: validatedData.medicalRecordId,
        name: validatedData.name,
        phone: validatedData.phone,
      },
    });

    if (existingContact) {
      return NextResponse.json(
        { error: "Ce contact existe déjà" },
        { status: 409 }
      );
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

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
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
    if (error instanceof z.ZodError) {
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

// PUT /api/health/emergency-contacts - Update emergency contact
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { id, medicalRecordId: _medicalRecordId, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    // Verify contact exists
    const existingContact = await prisma.emergencyContact.findUnique({
      where: { id },
    });

    if (!existingContact) {
      return NextResponse.json({ error: "Contact d'urgence non trouvé" }, { status: 404 });
    }

    // Parents can only update contacts for their own children
    if (session.user.role === "PARENT") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        include: { children: true },
      });

      const medicalRecord = await prisma.medicalRecord.findUnique({
        where: { id: existingContact.medicalRecordId },
      });

      const isParent = parentProfile?.children.some(
        (c) => c.studentId === medicalRecord?.studentId
      );

      if (!isParent) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    // If setting as primary, unset other primary contacts
    if (updateData.isPrimary && !existingContact.isPrimary) {
      await prisma.emergencyContact.updateMany({
        where: {
          medicalRecordId: existingContact.medicalRecordId,
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

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entity: "EmergencyContact",
        entityId: id,
        newValues: updateData,
      },
    });

    logger.info("Emergency contact updated", { contactId: id });

    return NextResponse.json({ emergencyContact });
  } catch (error) {
    if (error instanceof z.ZodError) {
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

// DELETE /api/health/emergency-contacts - Delete emergency contact
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    // Verify contact exists
    const existingContact = await prisma.emergencyContact.findUnique({
      where: { id },
    });

    if (!existingContact) {
      return NextResponse.json({ error: "Contact d'urgence non trouvé" }, { status: 404 });
    }

    // Parents can only delete contacts for their own children
    if (session.user.role === "PARENT") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        include: { children: true },
      });

      const medicalRecord = await prisma.medicalRecord.findUnique({
        where: { id: existingContact.medicalRecordId },
      });

      const isParent = parentProfile?.children.some(
        (c) => c.studentId === medicalRecord?.studentId
      );

      if (!isParent) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    // Cannot delete primary contact if it's the only one
    if (existingContact.isPrimary) {
      const contactCount = await prisma.emergencyContact.count({
        where: { medicalRecordId: existingContact.medicalRecordId },
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

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
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

// PATCH /api/health/emergency-contacts/set-primary - Set primary contact
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    // Verify contact exists
    const existingContact = await prisma.emergencyContact.findUnique({
      where: { id },
    });

    if (!existingContact) {
      return NextResponse.json({ error: "Contact d'urgence non trouvé" }, { status: 404 });
    }

    // Parents can only set primary for their own children
    if (session.user.role === "PARENT") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        include: { children: true },
      });

      const medicalRecord = await prisma.medicalRecord.findUnique({
        where: { id: existingContact.medicalRecordId },
      });

      const isParent = parentProfile?.children.some(
        (c) => c.studentId === medicalRecord?.studentId
      );

      if (!isParent) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    // Unset all other primary contacts for this medical record
    await prisma.emergencyContact.updateMany({
      where: { medicalRecordId: existingContact.medicalRecordId },
      data: { isPrimary: false },
    });

    // Set this contact as primary
    const updatedContact = await prisma.emergencyContact.update({
      where: { id },
      data: { isPrimary: true },
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

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "SET_PRIMARY_CONTACT",
        entity: "EmergencyContact",
        entityId: id,
        newValues: { medicalRecordId: existingContact.medicalRecordId },
      },
    });

    logger.info("Primary emergency contact set", { contactId: id });

    return NextResponse.json({ emergencyContact: updatedContact });
  } catch (error) {
    logger.error("Error setting primary contact", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la définition du contact principal" },
      { status: 500 }
    );
  }
}
