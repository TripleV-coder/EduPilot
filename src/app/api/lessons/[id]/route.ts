import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/utils/logger";
import { assertModelAccess } from "@/lib/security/tenant";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }
    const guard = await assertModelAccess(session, "lesson", id, "Leçon non trouvée");
    if (guard) return guard;

    const lesson = await prisma.lesson.findUnique({
      where: { id: id },
      include: {
        module: {
          include: {
            course: {
              include: {
                classSubject: {
                  include: {
                    subject: true,
                  },
                },
                modules: {
                  orderBy: { order: "asc" },
                  include: {
                    lessons: {
                      orderBy: { order: "asc" },
                      select: { id: true, title: true, type: true, order: true }
                    }
                  }
                }
              },
            },
          },
        },
        completions: {
          where: {
            student: {
              userId: session.user.id
            }
          }
        }
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Leçon non trouvée" }, { status: 404 });
    }

    // Students only see published courses
    if (session.user.role === "STUDENT" && !lesson.module.course.isPublished) {
      return NextResponse.json({ error: "Leçon non disponible" }, { status: 404 });
    }

    return NextResponse.json({
        ...lesson,
        isCompleted: lesson.completions.length > 0
    });
  } catch (error) {
    logger.error("Error fetching lesson:", error as Error);
    return NextResponse.json({ error: "Erreur lors de la récupération de la leçon" }, { status: 500 });
  }
}
