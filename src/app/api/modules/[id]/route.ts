import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

const updateModuleSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().optional().nullable(),
  order: z.number().int().min(0).optional(),
});

// GET /api/modules/[id] - Get module details
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const courseModule = await prisma.courseModule.findUnique({
      where: { id: params.id },
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

    // Verify access
    if (courseModule.course.classSubject.subject.schoolId !== session.user.schoolId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Students only see published courses
    if (session.user.role === "STUDENT" && !courseModule.course.isPublished) {
      return NextResponse.json({ error: "Module non disponible" }, { status: 404 });
    }

    return NextResponse.json(courseModule);
  } catch (error) {
    logger.error(" fetching module:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

// PATCH /api/modules/[id] - Update module
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user || !["TEACHER", "SCHOOL_ADMIN", "DIRECTOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = updateModuleSchema.parse(body);

    const courseModule = await prisma.courseModule.findUnique({
      where: { id: params.id },
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

    const updatedModule = await prisma.courseModule.update({
      where: { id: params.id },
      data: validatedData,
      include: {
        lessons: {
          orderBy: { order: "asc" },
        },
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entity: "CourseModule",
        entityId: params.id,
      },
    });

    return NextResponse.json(updatedModule);
  } catch (error) {
    if (error instanceof z.ZodError) {
    }
    logger.error(" updating module:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

// DELETE /api/modules/[id] - Delete module
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user || !["TEACHER", "SCHOOL_ADMIN", "DIRECTOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const courseModule = await prisma.courseModule.findUnique({
      where: { id: params.id },
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

    await prisma.courseModule.delete({
      where: { id: params.id },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE",
        entity: "CourseModule",
        entityId: params.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(" deleting module:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
