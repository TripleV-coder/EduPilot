import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/utils/logger";

/**
 * API Endpoint for bulk attendance recording
 */

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Only teachers and admins can record attendance
    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];
    if (!allowedRoles.includes(session.user.role as string)) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const body = await request.json();
    const { records, classId, date } = body;

    if (!records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { error: "Aucun enregistrement fourni" },
        { status: 400 }
      );
    }

    if (!classId || !date) {
      return NextResponse.json(
        { error: "ID de classe et date requis" },
        { status: 400 }
      );
    }

    // Verify class belongs to user's school
    const classRecord = await prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, schoolId: true },
    });

    if (!classRecord) {
      return NextResponse.json({ error: "Classe non trouvée" }, { status: 404 });
    }

    if (session.user.role !== "SUPER_ADMIN" && classRecord.schoolId !== session.user.schoolId) {
      return NextResponse.json(
        { error: "Accès non autorisé à cette classe" },
        { status: 403 }
      );
    }

    // Create or update attendance records
    // Loop over records. Note: upsert requires unique constraint on [studentId, classId, date] which exists in schema
    const results = await prisma.$transaction(
      records.map((record: { studentId: string; status: string; notes?: string }) =>
        prisma.attendance.upsert({
          where: {
            studentId_classId_date: {
              studentId: record.studentId,
              classId,
              date: new Date(date)
            }
          },
          create: {
            studentId: record.studentId,
            classId,
            date: new Date(date),
            status: record.status as any, // Cast to enum
            reason: record.notes, // Map notes to reason
            recordedById: session.user.id,
          },
          update: {
            status: record.status as any,
            reason: record.notes,
            recordedById: session.user.id,
          },
        })
      )
    );

    logger.info(`Bulk attendance: ${results.length} records saved by ${session.user.id}`);

    return NextResponse.json({
      success: true,
      count: results.length,
      message: `${results.length} enregistrements sauvegardés`,
    });
  } catch (error) {
    logger.error("Bulk attendance error:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de l'enregistrement des présences" },
      { status: 500 }
    );
  }
}

// GET endpoint to fetch bulk attendance data for a class
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const date = searchParams.get("date");

    if (!classId || !date) {
      return NextResponse.json(
        { error: "ID de classe et date requis" },
        { status: 400 }
      );
    }

    // Fetch existing attendance for this class and date
    const attendance = await prisma.attendance.findMany({
      where: {
        classId,
        date: new Date(date),
      },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    return NextResponse.json(attendance);
  } catch (error) {
    logger.error("Fetch bulk attendance error:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des présences" },
      { status: 500 }
    );
  }
}
