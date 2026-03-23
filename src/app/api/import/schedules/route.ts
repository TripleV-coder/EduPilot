import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";

const DAY_MAP: Record<string, number> = {
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
};

/**
 * POST /api/import/schedules
 * Importer des emplois du temps pour une classe
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];
    if (!allowedRoles.includes(session.user.role as string)) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const body = await request.json();
    const { classId, data, replaceExisting = false } = body;

    if (!classId || !Array.isArray(data)) {
      return NextResponse.json(
        { error: "classId et data (tableau) sont requis" },
        { status: 400 }
      );
    }

    // Verify class exists
    const classData = await prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, schoolId: true },
    });

    if (!classData) {
      return NextResponse.json({ error: "Classe introuvable" }, { status: 404 });
    }
    if (session.user.role !== "SUPER_ADMIN" && classData.schoolId !== session.user.schoolId) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    // Preload classSubjects for this class to match by subject code
    const classSubjects = await prisma.classSubject.findMany({
      where: { classId },
      include: { subject: { select: { code: true } } },
    });

    const csMap: Record<string, string> = {};
    for (const cs of classSubjects) {
      csMap[cs.subject.code.toLowerCase()] = cs.id;
    }

    const errors: Array<{ row: number; message: string }> = [];
    const schedulesToCreate: Array<{
      classId: string;
      classSubjectId: string | null;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      room: string | null;
    }> = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowIndex = i + 1;

      // Validate jour
      const jour = (row.jour || "").toString().toLowerCase().trim();
      const dayOfWeek = DAY_MAP[jour];
      if (!dayOfWeek) {
        errors.push({ row: rowIndex, message: `Jour invalide: "${row.jour}"` });
        continue;
      }

      // Validate times
      if (!row.heure_debut || !row.heure_fin) {
        errors.push({ row: rowIndex, message: "Heures de début et fin requises" });
        continue;
      }

      // Match classSubject by subject code
      const matiere = (row.matiere || "").toString().toLowerCase().trim();
      const classSubjectId = csMap[matiere] || null;

      schedulesToCreate.push({
        classId,
        classSubjectId,
        dayOfWeek,
        startTime: row.heure_debut.toString(),
        endTime: row.heure_fin.toString(),
        room: row.salle ? row.salle.toString() : null,
      });
    }

    // Safe mode by default: update/create rows without deleting existing planning.
    // Full replace is available with replaceExisting=true.
    await prisma.$transaction(async (tx) => {
      if (replaceExisting) {
        await tx.schedule.deleteMany({ where: { classId } });
        if (schedulesToCreate.length > 0) {
          await tx.schedule.createMany({ data: schedulesToCreate });
        }
        return;
      }

      for (const schedule of schedulesToCreate) {
        const existing = await tx.schedule.findFirst({
          where: {
            classId: schedule.classId,
            dayOfWeek: schedule.dayOfWeek,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
          },
          select: { id: true },
        });

        if (existing) {
          await tx.schedule.update({
            where: { id: existing.id },
            data: {
              classSubjectId: schedule.classSubjectId,
              room: schedule.room,
            },
          });
        } else {
          await tx.schedule.create({ data: schedule });
        }
      }
    });

    return NextResponse.json({
      imported: schedulesToCreate.length,
      errors,
      replaced: Boolean(replaceExisting),
    });
  } catch (error) {
    logger.error("importing schedules:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de l'importation des emplois du temps" },
      { status: 500 }
    );
  }
}
