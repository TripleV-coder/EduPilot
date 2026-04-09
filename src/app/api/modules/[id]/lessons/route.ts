import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { assertModelAccess } from "@/lib/security/tenant";

const createLessonSchema = z.object({
  title: z.string().min(3).max(200),
  content: z.string(),
  type: z.enum(["TEXT", "VIDEO", "PDF", "QUIZ", "ASSIGNMENT"]).default("TEXT"),
  videoUrl: z.string().url().optional(),
  fileUrl: z.string().url().optional(),
  duration: z.number().int().min(1).optional(),
  order: z.number().int().min(0),
});



// GET /api/modules/[id]/lessons - List lessons in module
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
    const guard = await assertModelAccess(session, "module", id, "Module non trouvé");
    if (guard) return guard;

    const courseModule = await prisma.courseModule.findUnique({
      where: { id: id },
      include: {
        course: {
          include: {
            classSubject: {
              include: {
                subject: true,
              },
            },
          },
        },
        lessons: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!courseModule) {
      return NextResponse.json({ error: "Module non trouvé" }, { status: 404 });
    }

    // Students only see published courses
    if (session.user.role === "STUDENT" && !courseModule.course.isPublished) {
      return NextResponse.json({ error: "Module non disponible" }, { status: 404 });
    }

    return NextResponse.json(courseModule.lessons);
  } catch (error) {
    logger.error(" fetching lessons:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

// POST /api/modules/[id]/lessons - Create lesson in module
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user || !["TEACHER", "SCHOOL_ADMIN", "DIRECTOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    const guard = await assertModelAccess(session, "module", id, "Module non trouvé");
    if (guard) return guard;

    const body = await request.json();
    const validatedData = createLessonSchema.parse(body);

    const courseModule = await prisma.courseModule.findUnique({
      where: { id: id },
      include: {
        course: {
          include: {
            classSubject: {
              include: {
                subject: true,
                teacher: true,
              },
            },
          },
        },
      },
    });

    if (!courseModule) {
      return NextResponse.json({ error: "Module non trouvé" }, { status: 404 });
    }

    // Verify ownership if teacher
    if (session.user.role === "TEACHER") {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
      });

      if (!teacherProfile || courseModule.course.classSubject.teacherId !== teacherProfile.id) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    const lesson = await prisma.lesson.create({
      data: {
        moduleId: id,
        title: validatedData.title,
        content: validatedData.content,
        type: validatedData.type,
        videoUrl: validatedData.videoUrl,
        fileUrl: validatedData.fileUrl,
        duration: validatedData.duration,
        order: validatedData.order,
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entity: "Lesson",
        entityId: lesson.id,
      },
    });

    return NextResponse.json(lesson, { status: 201 });
  } catch (error) {
    if (isZodError(error)) {
      return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
    }
    logger.error(" creating lesson:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
