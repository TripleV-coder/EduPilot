import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { assertModelAccess } from "@/lib/security/tenant";

const updateScholarshipSchema = z.object({
  name: z.string().min(3).max(200).optional(),
  type: z.enum(["MERIT", "NEED_BASED", "ATHLETIC", "PARTIAL", "FULL", "OTHER"]).optional(),
  amount: z.number().positive().optional(),
  percentage: z.number().int().min(1).max(100).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
  notes: z.string().optional().nullable(),
});

// GET /api/scholarships/[id] - Get scholarship details
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
    const guard = await assertModelAccess(session, "scholarship", id, "Bourse non trouvée");
    if (guard) return guard;

    const scholarship = await prisma.scholarship.findUnique({
      where: { id: id },
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            parentStudents: {
              include: {
                parent: {
                  include: {
                    user: {
                      select: { id: true },
                    },
                  },
                },
              },
            },
            enrollments: {
              where: { status: "ACTIVE" },
              include: {
                class: {
                  include: {
                    classLevel: true,
                  },
                },
                academicYear: true,
              },
            },
          },
        },
      },
    });

    if (!scholarship) {
      return NextResponse.json({ error: "Bourse non trouvée" }, { status: 404 });
    }

    // Verify access
    if (session.user.role === "STUDENT") {
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
      });
      if (studentProfile?.id !== scholarship.studentId) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    } else if (session.user.role === "PARENT") {
      const isParent = scholarship.student.parentStudents.some(
        (link: { parent: { user: { id: string } } }) => link.parent.user.id === session.user.id
      );
      if (!isParent) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
    } else if (!["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"].includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    return NextResponse.json(scholarship);
  } catch (error) {
    logger.error(" fetching scholarship:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

// PATCH /api/scholarships/[id] - Update scholarship
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user || !["SCHOOL_ADMIN", "DIRECTOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    const guard = await assertModelAccess(session, "scholarship", id, "Bourse non trouvée");
    if (guard) return guard;

    const body = await request.json();
    const validatedData = updateScholarshipSchema.parse(body);

    const scholarship = await prisma.scholarship.findUnique({
      where: { id: id },
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            parentStudents: {
              include: {
                parent: {
                  include: {
                    user: {
                      select: { id: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!scholarship) {
      return NextResponse.json({ error: "Bourse non trouvée" }, { status: 404 });
    }

    const wasActive = scholarship.isActive;

    const updateData: Prisma.ScholarshipUpdateInput = {};
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.type !== undefined) updateData.type = validatedData.type as any;
    if (validatedData.amount !== undefined) updateData.amount = validatedData.amount;
    if (validatedData.percentage !== undefined) updateData.percentage = validatedData.percentage;
    if (validatedData.startDate !== undefined) updateData.startDate = new Date(validatedData.startDate);
    if (validatedData.endDate !== undefined) {
      updateData.endDate = validatedData.endDate ? new Date(validatedData.endDate) : null;
    }
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;
    if (validatedData.notes !== undefined) updateData.notes = validatedData.notes;

    const updatedScholarship = await prisma.scholarship.update({
      where: { id: id },
      data: updateData,
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entity: "Scholarship",
        entityId: id,
      },
    });

    // Notify if status changed
    if (wasActive !== updatedScholarship.isActive) {
      const status = updatedScholarship.isActive ? "activée" : "désactivée";

      // Notify student
      await prisma.notification.create({
        data: {
          userId: scholarship.student.user.id,
          type: updatedScholarship.isActive ? "INFO" : "WARNING",
          title: `Bourse ${status}`,
          message: `Votre bourse "${updatedScholarship.name}" a été ${status}`,
          link: `/scholarships/${id}`,
        },
      });

      // Notify parents
      if (scholarship.student.parentStudents.length > 0) {
        await prisma.notification.createMany({
          data: scholarship.student.parentStudents.map(link => ({
            userId: link.parent.user.id,
            type: updatedScholarship.isActive ? "INFO" : "WARNING",
            title: `Bourse ${status}`,
            message: `La bourse "${updatedScholarship.name}" de ${scholarship.student.user.firstName} a été ${status}`,
            link: `/scholarships/${id}`,
          })),
        });
      }
    }

    return NextResponse.json(updatedScholarship);
  } catch (error) {
    if (isZodError(error)) {
      return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
    }
    logger.error(" updating scholarship:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

// DELETE /api/scholarships/[id] - Delete scholarship
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user || !["SCHOOL_ADMIN", "DIRECTOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    const guard = await assertModelAccess(session, "scholarship", id, "Bourse non trouvée");
    if (guard) return guard;

    const scholarship = await prisma.scholarship.findUnique({
      where: { id: id },
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            parentStudents: {
              include: {
                parent: {
                  include: {
                    user: {
                      select: { id: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!scholarship) {
      return NextResponse.json({ error: "Bourse non trouvée" }, { status: 404 });
    }

    await prisma.scholarship.delete({
      where: { id: id },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE",
        entity: "Scholarship",
        entityId: id,
      },
    });

    // Notify student
    await prisma.notification.create({
      data: {
        userId: scholarship.student.user.id,
        type: "WARNING",
        title: "Bourse supprimée",
        message: `Votre bourse "${scholarship.name}" a été supprimée`,
      },
    });

    // Notify parents
    if (scholarship.student.parentStudents.length > 0) {
      await prisma.notification.createMany({
        data: scholarship.student.parentStudents.map(link => ({
          userId: link.parent.user.id,
          type: "WARNING",
          title: "Bourse supprimée",
          message: `La bourse "${scholarship.name}" de ${scholarship.student.user.firstName} a été supprimée`,
        })),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(" deleting scholarship:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
