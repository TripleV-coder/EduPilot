import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "STUDENT") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!studentProfile) {
      return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
    }

    // Check if already started
    const existing = await prisma.examSession.findUnique({
      where: {
        examTemplateId_studentId: {
          examTemplateId: params.id,
          studentId: studentProfile.id,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "Examen déjà commencé" }, { status: 400 });
    }

    const exam = await prisma.examTemplate.findUnique({
      where: { id: params.id },
      include: { questions: true },
    });

    if (!exam || !exam.isPublished) {
      return NextResponse.json({ error: "Examen non disponible" }, { status: 404 });
    }

    const session_exam = await prisma.examSession.create({
      data: {
        examTemplateId: params.id,
        studentId: studentProfile.id,
        totalPoints: exam.totalPoints,
      },
      include: {
        examTemplate: {
          include: {
            questions: {
              select: {
                id: true,
                type: true,
                question: true,
                points: true,
                order: true,
                options: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(session_exam, { status: 201 });
  } catch (error) {
    logger.error(" starting exam:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
