import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const [schoolsCount, studentsCount, classesCount, teachersCount] =
      await Promise.all([
        prisma.school.count({ where: { isActive: true } }),
        prisma.studentProfile.count({ where: { deletedAt: null } }),
        prisma.class.count(),
        prisma.teacherProfile.count(),
      ]);

    return NextResponse.json(
      {
        schools: schoolsCount,
        students: studentsCount,
        classes: classesCount,
        teachers: teachersCount,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  } catch (error) {
    logger.error("Explorer overview error", error as Error);
    return NextResponse.json(
      { error: "Erreur lors du chargement des statistiques réelles" },
      { status: 500 }
    );
  }
}
