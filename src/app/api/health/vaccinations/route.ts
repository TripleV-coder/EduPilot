import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

// Validation schema for vaccination
const vaccinationSchema = z.object({
  medicalRecordId: z.string().cuid(),
  vaccineName: z.string(),
  dateGiven: z.string(),
  administeredBy: z.string().optional(),
  batchNumber: z.string().optional(),
  nextDueDate: z.string().optional(),
});

// GET /api/health/vaccinations - Get vaccination records
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const medicalRecordId = searchParams.get("medicalRecordId");
    const studentId = searchParams.get("studentId");
    const includeOverdue = searchParams.get("includeOverdue") === "true";

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

    // Role-based filtering for students
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

    const vaccinations = await prisma.vaccination.findMany({
      where,
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

    // Calculate vaccination coverage statistics
    const vaccinationStats = await getVaccinationStats(where, includeOverdue);

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

// Helper function to calculate vaccination stats
async function getVaccinationStats(where: any, includeOverdue: boolean) {
  // French vaccination schedule requirements
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

  // Get all medical records with vaccinations
  const medicalRecords = await prisma.medicalRecord.findMany({
    where: where.medicalRecordId ? { id: where.medicalRecordId } : undefined,
    include: {
      student: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
      vaccinations: true,
    },
  });

  const now = new Date();

  // Calculate overall completion
  const studentsFullyVaccinated = medicalRecords.filter((mr) => {
    const vaccineNames = mr.vaccinations.map((v) => v.vaccineName.toLowerCase());
    return requiredVaccines.every((vaccine) =>
      vaccineNames.some((name) => name.includes(vaccine.toLowerCase()))
    );
  });

  // Get overdue vaccinations
  const overdueVaccinations = includeOverdue
    ? await prisma.vaccination.findMany({
      where: {
        ...where,
        nextDueDate: { lt: now },
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
    overdueVaccinations: overdueVaccinations.map((v) => ({
      id: v.id,
      studentName: `${v.medicalRecord.student.user.firstName} ${v.medicalRecord.student.user.lastName}`,
      vaccineName: v.vaccineName,
      dueDate: v.nextDueDate,
    })),
  };
}

// POST /api/health/vaccinations - Add vaccination record
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "NURSE", "SECRETARY"];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = vaccinationSchema.parse(body);

    // Verify medical record exists
    const medicalRecord = await prisma.medicalRecord.findUnique({
      where: { id: validatedData.medicalRecordId },
    });

    if (!medicalRecord) {
      return NextResponse.json({ error: "Dossier médical non trouvé" }, { status: 404 });
    }

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

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
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
    if (error instanceof z.ZodError) {
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

// PUT /api/health/vaccinations - Update vaccination record
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "NURSE", "SECRETARY"];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const { id, medicalRecordId: _medicalRecordId, ...updateData } = body;

    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

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

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entity: "Vaccination",
        entityId: id,
        newValues: updateData,
      },
    });

    logger.info("Vaccination record updated", { vaccinationId: id });

    return NextResponse.json({ vaccination });
  } catch (error) {
    if (error instanceof z.ZodError) {
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

// DELETE /api/health/vaccinations - Delete vaccination record
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "NURSE"];
    if (!allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID requis" }, { status: 400 });
    }

    await prisma.vaccination.delete({
      where: { id },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
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
