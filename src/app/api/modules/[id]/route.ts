import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { assertModelAccess } from "@/lib/security/tenant";

const updateModuleSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  description: z.string().optional().nullable(),
  order: z.number().int().min(0).optional(),
});

// GET /api/modules/[id] - Get module details
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

    return NextResponse.json(courseModule);
  } catch (error) {
    logger.error(" fetching module:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

// PATCH /api/modules/[id] - Update module
export async function PATCH(
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
    const validatedData = updateModuleSchema.parse(body);

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

    const updatedModule = await prisma.courseModule.update({
      where: { id: id },
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
        entityId: id,
      },
    });

    return NextResponse.json(updatedModule);
  } catch (error) {
    if (isZodError(error)) {
      return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
    }
    logger.error(" updating module:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

// DELETE /api/modules/[id] - Delete module
export async function DELETE(
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

    await prisma.courseModule.delete({
      where: { id: id },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE",
        entity: "CourseModule",
        entityId: id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(" deleting module:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
