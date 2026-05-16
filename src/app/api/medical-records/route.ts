import { NextRequest, NextResponse } from "next/server";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { createApiHandler } from "@/lib/api/api-helpers";
import { Permission } from "@/lib/rbac/permissions";
import {
  HEALTH_READ_ROLES,
  HEALTH_STAFF_ROLES,
  ensureStudentHealthAccess,
  getOwnStudentProfile,
  requireHealthRole,
} from "@/lib/health/access";

const createMedicalRecordSchema = z.object({
  studentId: z.string().cuid(),
  bloodType: z.string().optional(),
  medicalHistory: z.string().optional(),
  medications: z.array(z.string()).optional(),
  conditions: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export const GET = createApiHandler(
  async (request: NextRequest, { session }): Promise<NextResponse> => {
    // Additional health-specific role check
    const roleError = requireHealthRole(session, HEALTH_READ_ROLES);
    if (roleError) return roleError;

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");

    let targetStudentId = studentId;
    if (session.user.role === "STUDENT") {
      const ownStudentProfile = await getOwnStudentProfile(session.user.id);
      if (!ownStudentProfile) {
        return NextResponse.json({ error: "Profil étudiant non trouvé" }, { status: 404 });
      }
      targetStudentId = ownStudentProfile.id;
    }

    if (!targetStudentId) {
      return NextResponse.json(
        { error: "studentId requis" },
        { status: 400 }
      );
    }

    const access = await ensureStudentHealthAccess(session, targetStudentId);
    if ("response" in access) return access.response!;

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
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.MEDICAL_READ],
  }
);

export const POST = createApiHandler(
  async (request: NextRequest, { session }): Promise<NextResponse> => {
    // Additional health-specific staff role check
    const roleError = requireHealthRole(session, HEALTH_STAFF_ROLES);
    if (roleError) return roleError;

    const body = await request.json();
    const validatedData = createMedicalRecordSchema.parse(body);

    const access = await ensureStudentHealthAccess(session, validatedData.studentId);
    if ("response" in access) return access.response!;

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
  },
  {
    requireAuth: true,
    requiredPermissions: [Permission.MEDICAL_READ],
  }
);
