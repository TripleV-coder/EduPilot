import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

const createMedicalRecordSchema = z.object({
  studentId: z.string().cuid(),
  bloodType: z.string().optional(),
  medicalHistory: z.string().optional(),
  medications: z.array(z.string()).optional(),
  conditions: z.array(z.string()).optional(),
  notes: z.string().optional(),
});



/**
 * GET /api/medical-records
 * Get medical record (filtered by role)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

    const userRole = session.user.role;
    let targetStudentId = studentId;

    // Role-based access
    if (userRole === "STUDENT") {
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
      });
      targetStudentId = studentProfile?.id || null;
    } else if (userRole === "PARENT") {
      if (!studentId) {
        return NextResponse.json(
          { error: "studentId requis pour les parents" },
          { status: 400 }
        );
      }
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        include: { children: true },
      });
      const childrenIds = parentProfile?.children.map(c => c.studentId) || [];
      if (!childrenIds.includes(studentId)) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    } else if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"].includes(userRole)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    if (!targetStudentId) {
      return NextResponse.json(
        { error: "Aucun dossier trouvé" },
        { status: 404 }
      );
    }

    const medicalRecord = await prisma.medicalRecord.findUnique({
      where: { studentId: targetStudentId },
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        allergies: true,
        vaccinations: {
          orderBy: { dateGiven: "desc" },
        },
        emergencyContacts: {
          orderBy: { isPrimary: "desc" },
        },
      },
    });

    if (!medicalRecord) {
      return NextResponse.json(
        { error: "Dossier médical non trouvé" },
        { status: 404 }
      );
    }

    return NextResponse.json(medicalRecord);
  } catch (error) {
    logger.error(" fetching medical record:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du dossier médical" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/medical-records
 * Create or update medical record (Admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createMedicalRecordSchema.parse(body);

    const medicalRecord = await prisma.medicalRecord.upsert({
      where: { studentId: validatedData.studentId },
      create: {
        studentId: validatedData.studentId,
        bloodType: validatedData.bloodType,
        medicalHistory: validatedData.medicalHistory,
        medications: validatedData.medications || [],
        conditions: validatedData.conditions || [],
        notes: validatedData.notes,
      },
      update: {
        bloodType: validatedData.bloodType,
        medicalHistory: validatedData.medicalHistory,
        medications: validatedData.medications || [],
        conditions: validatedData.conditions || [],
        notes: validatedData.notes,
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
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
        action: "UPDATE_MEDICAL_RECORD",
        entity: "MedicalRecord",
        entityId: medicalRecord.id,
        newValues: validatedData,
      },
    });

    return NextResponse.json(medicalRecord, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { status: 400 }
      );
    }

    logger.error(" creating medical record:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la création du dossier médical" },
      { status: 500 }
    );
  }
}
