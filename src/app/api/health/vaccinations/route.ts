import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import {
  HEALTH_READ_ROLES,
  HEALTH_VACCINATION_WRITE_ROLES,
  ensureMedicalRecordHealthAccess,
  ensureStudentHealthAccess,
  ensureVaccinationHealthAccess,
  getOwnStudentProfile,
  getParentStudentIds,
  requireHealthRole,
} from "@/lib/health/access";

const vaccinationSchema = z.object({
  medicalRecordId: z.string().cuid(),
  vaccineName: z.string(),
  dateGiven: z.string(),
  administeredBy: z.string().optional(),
  batchNumber: z.string().optional(),
  nextDueDate: z.string().optional(),
});

type VaccinationStatsInput = {
  medicalRecordWhere: Prisma.MedicalRecordWhereInput;
  vaccinationWhere: Prisma.VaccinationWhereInput;
  includeOverdue: boolean;
};

async function getVaccinationStats({
  medicalRecordWhere,
  vaccinationWhere,
  includeOverdue,
}: VaccinationStatsInput) {
  const requiredVaccines = [
    "DT-Polio",
    "Coqueluche",
    "Haemophilus",
    "Hépatite B",
    "Méningocoque C",
    "ROR",
    "HPV",
    "Varicelle",
  ];

  const medicalRecords = await prisma.medicalRecord.findMany({
    where: medicalRecordWhere,
    include: {
      student: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
      vaccinations: true,
    },
  });

  const now = new Date();
  const studentsFullyVaccinated = medicalRecords.filter((medicalRecord) => {
    const vaccineNames = medicalRecord.vaccinations.map((vaccination) =>
      vaccination.vaccineName.toLowerCase()
    );

    return requiredVaccines.every((requiredVaccine) =>
      vaccineNames.some((name) => name.includes(requiredVaccine.toLowerCase()))
    );
  });

  const overdueVaccinations = includeOverdue
    ? await prisma.vaccination.findMany({
        where: {
          AND: [
            vaccinationWhere,
            { nextDueDate: { lt: now } },
          ],
        },
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
      })
    : [];

  return {
    totalStudents: medicalRecords.length,
    fullyVaccinated: studentsFullyVaccinated.length,
    coveragePercentage:
      medicalRecords.length > 0
        ? (studentsFullyVaccinated.length / medicalRecords.length) * 100
        : 0,
    overdueCount: overdueVaccinations.length,
    overdueVaccinations: overdueVaccinations.map((vaccination) => ({
      id: vaccination.id,
      studentName: `${vaccination.medicalRecord.student.user.firstName} ${vaccination.medicalRecord.student.user.lastName}`,
      vaccineName: vaccination.vaccineName,
      dueDate: vaccination.nextDueDate,
    })),
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    const roleError = requireHealthRole(session, HEALTH_READ_ROLES);
    if (roleError) return roleError;

    const { searchParams } = new URL(request.url);
    const medicalRecordId = searchParams.get("medicalRecordId");
    const studentId = searchParams.get("studentId");
    const includeOverdue = searchParams.get("includeOverdue") === "true";

    const vaccinationWhere: Prisma.VaccinationWhereInput = {};
    const medicalRecordWhere: Prisma.MedicalRecordWhereInput = {};

    if (medicalRecordId) {
      const access = await ensureMedicalRecordHealthAccess(session, medicalRecordId);
      if ("response" in access) return access.response;
      vaccinationWhere.medicalRecordId = medicalRecordId;
      medicalRecordWhere.id = medicalRecordId;
    } else if (studentId) {
      const access = await ensureStudentHealthAccess(session, studentId);
      if ("response" in access) return access.response;
      vaccinationWhere.medicalRecord = { studentId };
      medicalRecordWhere.studentId = studentId;
    } else if (session!.user.role === "PARENT") {
      const childIds = await getParentStudentIds(session!.user.id);
      vaccinationWhere.medicalRecord = { studentId: { in: childIds } };
      medicalRecordWhere.studentId = { in: childIds };
    } else if (session!.user.role === "STUDENT") {
      const ownStudentProfile = await getOwnStudentProfile(session!.user.id);
      if (!ownStudentProfile) {
        return NextResponse.json({ error: "Profil étudiant non trouvé" }, { status: 404 });
      }
      vaccinationWhere.medicalRecord = { studentId: ownStudentProfile.id };
      medicalRecordWhere.studentId = ownStudentProfile.id;
    } else if (session!.user.role !== "SUPER_ADMIN") {
      vaccinationWhere.medicalRecord = { student: { schoolId: session!.user.schoolId! } };
      medicalRecordWhere.student = { schoolId: session!.user.schoolId! };
    }

    const vaccinations = await prisma.vaccination.findMany({
      where: vaccinationWhere,
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
      orderBy: { dateGiven: "desc" },
    });

    const vaccinationStats = await getVaccinationStats({
      medicalRecordWhere,
      vaccinationWhere,
      includeOverdue,
    });

    return NextResponse.json({
      vaccinations,
      stats: vaccinationStats,
    });
  } catch (error) {
    logger.error("Error fetching vaccinations", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des vaccinations" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const roleError = requireHealthRole(session, HEALTH_VACCINATION_WRITE_ROLES);
    if (roleError) return roleError;

    const body = await request.json();
    const validatedData = vaccinationSchema.parse(body);

    const access = await ensureMedicalRecordHealthAccess(session, validatedData.medicalRecordId);
    if ("response" in access) return access.response;

    const vaccination = await prisma.vaccination.create({
      data: {
        medicalRecordId: validatedData.medicalRecordId,
        vaccineName: validatedData.vaccineName,
        dateGiven: new Date(validatedData.dateGiven),
        administeredBy: validatedData.administeredBy,
        batchNumber: validatedData.batchNumber,
        nextDueDate: validatedData.nextDueDate ? new Date(validatedData.nextDueDate) : null,
      },
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
        entity: "Vaccination",
        entityId: vaccination.id,
        newValues: { medicalRecordId: validatedData.medicalRecordId, vaccineName: validatedData.vaccineName },
      },
    });

    logger.info("Vaccination record created", {
      vaccinationId: vaccination.id,
      medicalRecordId: validatedData.medicalRecordId,
    });

    return NextResponse.json({ vaccination }, { status: 201 });
  } catch (error) {
    if (isZodError(error)) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }

    logger.error("Error creating vaccination record", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement de la vaccination" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    const roleError = requireHealthRole(session, HEALTH_VACCINATION_WRITE_ROLES);
    if (roleError) return roleError;

    const body = await request.json();
    const { id, medicalRecordId: _medicalRecordId, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    const access = await ensureVaccinationHealthAccess(session, id);
    if ("response" in access) return access.response;

    const vaccination = await prisma.vaccination.update({
      where: { id },
      data: {
        ...updateData,
        dateGiven: updateData.dateGiven ? new Date(updateData.dateGiven) : undefined,
        nextDueDate: updateData.nextDueDate ? new Date(updateData.nextDueDate) : undefined,
      },
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
        entity: "Vaccination",
        entityId: id,
        newValues: updateData,
      },
    });

    logger.info("Vaccination record updated", { vaccinationId: id });

    return NextResponse.json({ vaccination });
  } catch (error) {
    if (isZodError(error)) {
      return NextResponse.json(
        { error: "Données invalides", details: error.issues },
        { status: 400 }
      );
    }

    logger.error("Error updating vaccination record", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de la vaccination" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    const roleError = requireHealthRole(session, HEALTH_VACCINATION_WRITE_ROLES);
    if (roleError) return roleError;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    const access = await ensureVaccinationHealthAccess(session, id);
    if ("response" in access) return access.response;

    await prisma.vaccination.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        userId: session!.user.id,
        action: "DELETE",
        entity: "Vaccination",
        entityId: id,
      },
    });

    logger.info("Vaccination record deleted", { vaccinationId: id });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Error deleting vaccination record", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de la vaccination" },
      { status: 500 }
    );
  }
}
