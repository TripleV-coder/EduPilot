import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

const createExamSchema = z.object({
  classSubjectId: z.string().cuid(),
  title: z.string(),
  description: z.string().optional(),
  duration: z.number().min(15),
  totalPoints: z.number().default(100),
  passingScore: z.number().default(50),
  questions: z.array(z.object({
    type: z.enum(["MCQ", "TRUE_FALSE", "SHORT_ANSWER", "ESSAY", "FILL_BLANK"]),
    question: z.string(),
    points: z.number().default(1),
    order: z.number(),
    options: z.array(z.string()).optional(),
    correctAnswer: z.string().optional(),
    explanation: z.string().optional(),
  })),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "TEACHER"];
    if (!session?.user || !allowedRoles.includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createExamSchema.parse(body);

    const exam = await prisma.examTemplate.create({
      data: {
        classSubjectId: validatedData.classSubjectId,
        title: validatedData.title,
        description: validatedData.description,
        duration: validatedData.duration,
        totalPoints: validatedData.totalPoints,
        passingScore: validatedData.passingScore,
        createdById: session.user.id,
        questions: {
          create: validatedData.questions,
        },
      },
      include: {
        questions: true,
      },
    });

    return NextResponse.json(exam, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Données invalides",
          details: error.issues.map((e) => ({
            field: e.path.join("."),
            message: e.message,
          })),
        },
        { status: 400 }
      );
    }
    logger.error(" creating exam:", error as Error);
    return NextResponse.json({ error: "Erreur lors de la création de l'examen" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const classSubjectId = searchParams.get("classSubjectId");

    interface ExamWhereFilter {
      classSubjectId?: string;
      classSubject?: {
        class?: {
          schoolId?: string;
        };
      };
    }

    const where: ExamWhereFilter = {};

    // Non-SUPER_ADMIN must only see exams from their school
    if (session.user.role !== "SUPER_ADMIN" && session.user.schoolId) {
      where.classSubject = {
        class: {
          schoolId: session.user.schoolId,
        },
      };
    }

    if (classSubjectId) where.classSubjectId = classSubjectId;

    const exams = await prisma.examTemplate.findMany({
      where,
      include: {
        classSubject: {
          include: {
            subject: true,
            class: { include: { classLevel: true } },
          },
        },
        _count: {
          select: { questions: true, sessions: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ exams });
  } catch (error) {
    logger.error(" fetching exams:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
