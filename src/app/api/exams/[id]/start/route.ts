import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
          examTemplateId: id,
          studentId: studentProfile.id,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "Examen déjà commencé" }, { status: 400 });
    }

    const exam = await prisma.examTemplate.findUnique({
      where: { id: id },
      include: {
        questions: true,
        classSubject: { include: { class: { select: { id: true, schoolId: true } } } },
      },
    });

    if (!exam || !exam.isPublished) {
      return NextResponse.json({ error: "Examen non disponible" }, { status: 404 });
    }

    if (exam.classSubject.class.schoolId !== session.user.schoolId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const classEnrollment = await prisma.enrollment.findFirst({
      where: { studentId: studentProfile.id, classId: exam.classSubject.class.id, status: "ACTIVE" },
    });
    if (!classEnrollment) {
      return NextResponse.json({ error: "Vous devez être inscrit à cette classe" }, { status: 403 });
    }

    try {
      const session_exam = await prisma.examSession.create({
        data: {
          examTemplateId: id,
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
      if ((error as any).code === 'P2002') {
        return NextResponse.json({ error: "Examen déjà commencé" }, { status: 400 });
      }
      throw error;
    }
  } catch (error) {
    logger.error(" starting exam:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
