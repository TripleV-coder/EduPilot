import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { assertModelAccess } from "@/lib/security/tenant";

const createModuleSchema = z.object({
  courseId: z.string().cuid(),
  title: z.string().min(3).max(200),
  description: z.string().optional(),
  order: z.number().int().min(0),
});



// POST /api/modules - Create module
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !["SUPER_ADMIN", "TEACHER", "SCHOOL_ADMIN", "DIRECTOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createModuleSchema.parse(body);

    const course = await prisma.course.findUnique({
      where: { id: validatedData.courseId },
      include: {
        classSubject: {
          include: {
            subject: true,
            teacher: true,
          },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Cours non trouvé" }, { status: 404 });
    }

    const courseAccess = await assertModelAccess(session, "course", validatedData.courseId, "Cours non trouvé");
    if (courseAccess) return courseAccess;

    // Verify ownership if teacher
    if (session.user.role === "TEACHER") {
      const teacherProfile = await prisma.teacherProfile.findUnique({
        where: { userId: session.user.id },
      });

      if (!teacherProfile || course.classSubject.teacherId !== teacherProfile.id) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    }

    const courseModule = await prisma.courseModule.create({
      data: {
        courseId: validatedData.courseId,
        title: validatedData.title,
        description: validatedData.description,
        order: validatedData.order,
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entity: "CourseModule",
        entityId: courseModule.id,
      },
    });

    return NextResponse.json(courseModule, { status: 201 });
  } catch (error) {
    if (isZodError(error)) {
      return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
    }
    logger.error(" creating module:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
