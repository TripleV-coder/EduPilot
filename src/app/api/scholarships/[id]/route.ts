import { NextResponse } from "next/server";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { fcfaAmountSchema } from "@/lib/finance/money";
import { logger } from "@/lib/utils/logger";
import { assertModelAccess } from "@/lib/security/tenant";
import { roleSatisfies } from "@/lib/rbac/permissions";
import { invalidScholarshipFeeIds, overpaymentMessage, syncScholarshipPlans, type PlanAdjustment } from "@/lib/finance/scholarships";
import { alertFinanceStaff } from "@/lib/finance/online-payments";
import { createApiHandler } from "@/lib/api/api-helpers";

/** Règle 5 de scholarships.ts : un trop-perçu est signalé, jamais effacé. */
async function reportOverpayments(
  student: { schoolId: string; user: { firstName: string; lastName: string } },
  adjustments: PlanAdjustment[],
): Promise<void> {
  const name = `${student.user.firstName} ${student.user.lastName}`;
  for (const adjustment of adjustments.filter((a) => a.overpaid > 0)) {
    await alertFinanceStaff(student.schoolId, "Trop-perçu à rembourser", overpaymentMessage(name, adjustment));
  }
}

const updateScholarshipSchema = z.object({
  name: z.string().min(3).max(200).optional(),
  type: z.enum(["MERIT", "NEED_BASED", "ATHLETIC", "PARTIAL", "FULL", "OTHER"]).optional(),
  amount: fcfaAmountSchema.optional(),
  percentage: z.number().int().min(1).max(100).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
  notes: z.string().optional().nullable(),
  /** Frais visés (choix de l'école) ; vide = tous les frais obligatoires. */
  feeIds: z.array(z.string().cuid()).max(50).optional(),
}).refine((data) => !(data.amount !== undefined && data.percentage !== undefined), {
  message: "Indiquez soit un montant, soit un pourcentage (pas les deux)",
});

// GET /api/scholarships/[id] - Get scholarship details
export const GET = createApiHandler(async (request, context) => {
  try {
    const { id } = await context.params;
    const session = context.session;
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
    } else if (!roleSatisfies(session.user.role, ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"])) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    return NextResponse.json(scholarship);
  } catch (error) {
    logger.error(" fetching scholarship:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
});

// PATCH /api/scholarships/[id] - Update scholarship
export const PATCH = createApiHandler(
  async (request, context) => {
    try {
      const { id } = await context.params;
      const session = context.session;
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
      if (validatedData.type !== undefined) updateData.type = validatedData.type as Prisma.ScholarshipUpdateInput["type"];
      // Passer d'un pourcentage à un montant (ou l'inverse) efface l'autre
      // forme : sinon le pourcentage resterait appliqué (FIN-01).
      if (validatedData.amount !== undefined) {
        updateData.amount = validatedData.amount;
        updateData.percentage = null;
      }
      if (validatedData.percentage !== undefined) {
        updateData.percentage = validatedData.percentage;
        updateData.amount = 0;
      }
      if (validatedData.feeIds !== undefined) {
        if (await invalidScholarshipFeeIds(prisma, scholarship.student.schoolId, validatedData.feeIds)) {
          return NextResponse.json({ error: "Frais visés invalides : choisissez des frais de l'établissement de l'élève." }, { status: 400 });
        }
        updateData.feeIds = [...new Set(validatedData.feeIds)];
      }
      if (validatedData.startDate !== undefined) updateData.startDate = new Date(validatedData.startDate);
      if (validatedData.endDate !== undefined) {
        updateData.endDate = validatedData.endDate ? new Date(validatedData.endDate) : null;
      }
      if (validatedData.isActive !== undefined) updateData.isActive = validatedData.isActive;
      if (validatedData.notes !== undefined) updateData.notes = validatedData.notes;

      const { updatedScholarship, adjustments } = await prisma.$transaction(async (tx) => {
        const updated = await tx.scholarship.update({ where: { id: id }, data: updateData });
        return { updatedScholarship: updated, adjustments: await syncScholarshipPlans(tx, scholarship.studentId) };
      });
      await reportOverpayments(scholarship.student, adjustments);

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
            link: "/dashboard/scholarships",
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
              link: "/dashboard/scholarships",
            })),
          });
        }
      }

      return NextResponse.json({ ...updatedScholarship, planAdjustments: adjustments });
    } catch (error) {
      if (isZodError(error)) {
        return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
      }
      logger.error(" updating scholarship:", error as Error);
      return NextResponse.json({ error: "Erreur" }, { status: 500 });
    }
  },
  { allowedRoles: ["SCHOOL_ADMIN", "DIRECTOR"] }
);

// DELETE /api/scholarships/[id] - Delete scholarship
export const DELETE = createApiHandler(
  async (request, context) => {
    try {
      const { id } = await context.params;
      const session = context.session;
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

      // Suppression et recalcul des échéanciers dans la même transaction (FIN-01)
      const adjustments = await prisma.$transaction(async (tx) => {
        await tx.scholarship.delete({ where: { id: id } });
        return syncScholarshipPlans(tx, scholarship.studentId);
      });
      await reportOverpayments(scholarship.student, adjustments);

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
  },
  { allowedRoles: ["SCHOOL_ADMIN", "DIRECTOR"] }
);
