import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

const updateScholarshipSchema = z.object({
  name: z.string().min(3).max(200).optional(),
  type: z.enum(["MERIT", "NEED_BASED", "SPORTS", "ARTS", "ACADEMIC_EXCELLENCE", "DISABILITY", "OTHER"]).optional(),
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
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const scholarship = await prisma.scholarship.findUnique({
      where: { id: params.id },
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
            parentLinks: {
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
      const isParent = scholarship.student.parentLinks.some(
        (link: any) => link.parent.user.id === session.user.id
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
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user || !["SCHOOL_ADMIN", "DIRECTOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = updateScholarshipSchema.parse(body);

    const scholarship = await prisma.scholarship.findUnique({
      where: { id: params.id },
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
            parentLinks: {
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

    const updateData: any = {};
    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.type !== undefined) updateData.type = validatedData.type;
    if (validatedData.amount !== undefined) updateData.amount = validatedData.amount;
    if (validatedData.percentage !== undefined) updateData.percentage = validatedData.percentage;
    if (validatedData.startDate !== undefined) updateData.startDate = new Date(validatedData.startDate);
    if (validatedData.endDate !== undefined) {
      updateData.endDate = validatedData.endDate ? new Date(validatedData.endDate) : null;
    }
    if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;
    if (validatedData.notes !== undefined) updateData.notes = validatedData.notes;

    const updatedScholarship = await prisma.scholarship.update({
      where: { id: params.id },
      data: updateData,
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "UPDATE",
        entity: "Scholarship",
        entityId: params.id,
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
          link: `/scholarships/${params.id}`,
        },
      });

      // Notify parents
      if (scholarship.student.parentLinks.length > 0) {
        await prisma.notification.createMany({
          data: scholarship.student.parentLinks.map(link => ({
            userId: link.parent.user.id,
            type: updatedScholarship.isActive ? "INFO" : "WARNING",
            title: `Bourse ${status}`,
            message: `La bourse "${updatedScholarship.name}" de ${scholarship.student.user.firstName} a été ${status}`,
            link: `/scholarships/${params.id}`,
          })),
        });
      }
    }

    return NextResponse.json(updatedScholarship);
  } catch (error) {
    if (error instanceof z.ZodError) {
    }
    logger.error(" updating scholarship:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

// DELETE /api/scholarships/[id] - Delete scholarship
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user || !["SCHOOL_ADMIN", "DIRECTOR"].includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const scholarship = await prisma.scholarship.findUnique({
      where: { id: params.id },
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
            parentLinks: {
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
      where: { id: params.id },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DELETE",
        entity: "Scholarship",
        entityId: params.id,
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
    if (scholarship.student.parentLinks.length > 0) {
      await prisma.notification.createMany({
        data: scholarship.student.parentLinks.map(link => ({
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
