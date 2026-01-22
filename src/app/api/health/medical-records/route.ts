import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

// Validation schema for medical record
const medicalRecordSchema = z.object({
  studentId: z.string().cuid(),
  bloodType: z.string().optional(),
  medicalHistory: z.string().optional(),
  conditions: z.array(z.string()).default([]),
  medications: z.array(z.string()).default([]),
  notes: z.string().optional(),
  allergies: z.array(z.string()).optional(),
});

// GET /api/health/medical-records - Get medical records
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const recordId = searchParams.get("id");

    // Build where clause
    const where: any = {};

    if (studentId) {
      where.studentId = studentId;
    }

    if (recordId) {
      where.id = recordId;
    }

    // Role-based filtering
    if (session.user.role === "PARENT") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        include: { children: true },
      });

      if (parentProfile) {
        where.studentId = { in: parentProfile.children.map((c) => c.studentId) };
      } else {
        return NextResponse.json({ error: "Profil parent non trouvé" }, { status: 404 });
      }
    } else if (session.user.role === "STUDENT") {
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
      });

      if (studentProfile) {
        where.studentId = studentProfile.id;
      } else {
        return NextResponse.json({ error: "Profil étudiant non trouvé" }, { status: 404 });
      }
    }

    const medicalRecords = await prisma.medicalRecord.findMany({
      where,
      include: {
        student: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        allergies: true,
        vaccinations: true,
        emergencyContacts: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ medicalRecords });
  } catch (error) {
    logger.error("Error fetching medical records", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des dossiers médicaux" },
      { status: 500 }
    );
  }
}

// POST /api/health/medical-records - Create medical record
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Only admins, directors, and authorized staff can create records
    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "NURSE", "SECRETARY"];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = medicalRecordSchema.parse(body);

    // Verify student exists
    const student = await prisma.studentProfile.findUnique({
      where: { id: validatedData.studentId },
    });

    if (!student) {
      return NextResponse.json({ error: "Élève non trouvé" }, { status: 404 });
    }

    // Check if record already exists
    const existingRecord = await prisma.medicalRecord.findUnique({
      where: { studentId: validatedData.studentId },
    });

    if (existingRecord) {
      return NextResponse.json(
        { error: "Un dossier médical existe déjà pour cet élève" },
        { status: 409 }
      );
    }

    // Create medical record with nested data
    const medicalRecord = await prisma.medicalRecord.create({
      data: {
        studentId: validatedData.studentId,
        bloodType: validatedData.bloodType,
        medicalHistory: validatedData.medicalHistory,
        conditions: validatedData.conditions,
        medications: validatedData.medications,
        notes: validatedData.notes,
        allergies: validatedData.allergies && validatedData.allergies.length > 0 ? {
          create: validatedData.allergies.map((name) => ({
            allergen: name,
            severity: "moderate",
            isActive: true,
          })),
        } : undefined,
      },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        allergies: true,
        vaccinations: true,
        emergencyContacts: true,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entity: "MedicalRecord",
        entityId: medicalRecord.id,
        newValues: { studentId: validatedData.studentId },
      },
    });

    logger.info("Medical record created", {
      recordId: medicalRecord.id,
      studentId: validatedData.studentId,
    });

    return NextResponse.json({ medicalRecord }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }

    logger.error("Error creating medical record", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la création du dossier médical" },
      { status: 500 }
    );
  }
}

// PUT /api/health/medical-records - Update medical record
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "NURSE", "SECRETARY", "PARENT"];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const { id, allergies, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    // Verify record exists
    const existingRecord = await prisma.medicalRecord.findUnique({
      where: { id },
    });

    if (!existingRecord) {
      return NextResponse.json({ error: "Dossier médical non trouvé" }, { status: 404 });
    }

    // Parents can only update if they're the parent of this student
    if (session.user.role === "PARENT") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        include: { children: true },
      });

      const isParent = parentProfile?.children.some(
        (c) => c.studentId === existingRecord.studentId
      );

      if (!isParent) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    // Update main record
    const updatedRecord = await prisma.medicalRecord.update({
      where: { id },
      data: {
        ...updateData,
        allergies: allergies ? {
          deleteMany: {},
          create: allergies.map((name: string) => ({
            allergen: name,
            severity: "moderate",
            isActive: true,
          })),
        } : undefined,
      },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        allergies: true,
        vaccinations: true,
        emergencyContacts: true,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entity: "MedicalRecord",
        entityId: id,
        newValues: updateData,
      },
    });

    logger.info("Medical record updated", { recordId: id });

    return NextResponse.json({ medicalRecord: updatedRecord });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }

    logger.error("Error updating medical record", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du dossier médical" },
      { status: 500 }
    );
  }
}
