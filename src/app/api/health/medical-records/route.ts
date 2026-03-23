import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import {
  HEALTH_READ_ROLES,
  HEALTH_RECORD_WRITE_ROLES,
  HEALTH_STAFF_ROLES,
  ensureMedicalRecordHealthAccess,
  ensureStudentHealthAccess,
  getOwnStudentProfile,
  getParentStudentIds,
  requireHealthRole,
} from "@/lib/health/access";

const medicalRecordSchema = z.object({
  studentId: z.string().cuid(),
  bloodType: z.string().optional(),
  medicalHistory: z.string().optional(),
  conditions: z.array(z.string()).default([]),
  medications: z.array(z.string()).default([]),
  notes: z.string().optional(),
  allergies: z.array(z.string()).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const roleError = requireHealthRole(session, HEALTH_READ_ROLES);
    if (roleError) return roleError;

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const recordId = searchParams.get("id");
    const where: Prisma.MedicalRecordWhereInput = {};

    if (recordId) {
      const access = await ensureMedicalRecordHealthAccess(session, recordId);
      if ("response" in access) return access.response;
      where.id = recordId;
    } else if (studentId) {
      const access = await ensureStudentHealthAccess(session, studentId);
      if ("response" in access) return access.response;
      where.studentId = studentId;
    } else if (session!.user.role === "PARENT") {
      const childIds = await getParentStudentIds(session!.user.id);
      where.studentId = { in: childIds };
    } else if (session!.user.role === "STUDENT") {
      const ownStudentProfile = await getOwnStudentProfile(session!.user.id);
      if (!ownStudentProfile) {
        return NextResponse.json({ error: "Profil étudiant non trouvé" }, { status: 404 });
      }
      where.studentId = ownStudentProfile.id;
    } else if (session!.user.role !== "SUPER_ADMIN") {
      where.student = { schoolId: session!.user.schoolId! };
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

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const roleError = requireHealthRole(session, HEALTH_STAFF_ROLES);
    if (roleError) return roleError;

    const body = await request.json();
    const validatedData = medicalRecordSchema.parse(body);

    const access = await ensureStudentHealthAccess(session, validatedData.studentId);
    if ("response" in access) return access.response;

    const existingRecord = await prisma.medicalRecord.findUnique({
      where: { studentId: validatedData.studentId },
    });

    if (existingRecord) {
      return NextResponse.json(
        { error: "Un dossier médical existe déjà pour cet élève" },
        { status: 409 }
      );
    }

    const medicalRecord = await prisma.medicalRecord.create({
      data: {
        studentId: validatedData.studentId,
        bloodType: validatedData.bloodType,
        medicalHistory: validatedData.medicalHistory,
        conditions: validatedData.conditions,
        medications: validatedData.medications,
        notes: validatedData.notes,
        allergies: validatedData.allergies && validatedData.allergies.length > 0
          ? {
              create: validatedData.allergies.map((name) => ({
                allergen: name,
                severity: "moderate",
              })),
            }
          : undefined,
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

    await prisma.auditLog.create({
      data: {
        userId: session!.user.id,
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
    if (isZodError(error)) {
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

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    const roleError = requireHealthRole(session, HEALTH_RECORD_WRITE_ROLES);
    if (roleError) return roleError;

    const body = await request.json();
    const { id, allergies, studentId: _studentId, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    const access = await ensureMedicalRecordHealthAccess(session, id);
    if ("response" in access) return access.response;

    const updatedRecord = await prisma.medicalRecord.update({
      where: { id },
      data: {
        ...updateData,
        allergies: Array.isArray(allergies)
          ? {
              deleteMany: {},
              create: allergies.map((name: string) => ({
                allergen: name,
                severity: "moderate",
              })),
            }
          : undefined,
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

    await prisma.auditLog.create({
      data: {
        userId: session!.user.id,
        action: "UPDATE",
        entity: "MedicalRecord",
        entityId: id,
        newValues: updateData,
      },
    });

    logger.info("Medical record updated", { recordId: id });

    return NextResponse.json({ medicalRecord: updatedRecord });
  } catch (error) {
    if (isZodError(error)) {
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
