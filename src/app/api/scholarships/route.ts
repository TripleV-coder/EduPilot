import { NextResponse } from "next/server";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { fcfaAmountSchema } from "@/lib/finance/money";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { resolveFinanceSchool, superAdminTargetOutOfScope } from "@/lib/finance/finance-scope";
import { roleSatisfies } from "@/lib/rbac/permissions";
import { invalidScholarshipFeeIds, overpaymentMessage, syncScholarshipPlans } from "@/lib/finance/scholarships";
import { alertFinanceStaff } from "@/lib/finance/online-payments";
import { createApiHandler } from "@/lib/api/api-helpers";

const createScholarshipSchema = z.object({
  studentId: z.string().cuid(),
  name: z.string().min(3).max(200),
  type: z.enum(["MERIT", "NEED_BASED", "ATHLETIC", "PARTIAL", "FULL", "OTHER"]),
  amount: fcfaAmountSchema.optional(),
  percentage: z.number().int().min(1).max(100).optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  isActive: z.boolean().default(true),
  notes: z.string().optional(),
  /** Frais visés (choix de l'école) ; vide = tous les frais obligatoires. */
  feeIds: z.array(z.string().cuid()).max(50).default([]),
}).refine(data => (data.amount !== undefined) !== (data.percentage !== undefined), {
  message: "Indiquez soit un montant, soit un pourcentage (pas les deux)",
});

// GET /api/scholarships - List scholarships
export const GET = createApiHandler(async (request, context) => {
  try {
    const session = context.session;
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const isActive = searchParams.get("isActive");

    const where: Prisma.ScholarshipWhereInput = {};

    // Role-based filtering
    if (session.user.role === "STUDENT") {
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId: session.user.id },
      });
      if (!studentProfile) {
        return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
      }
      where.studentId = studentProfile.id;
    } else if (session.user.role === "PARENT") {
      const parentProfile = await prisma.parentProfile.findUnique({
        where: { userId: session.user.id },
        include: {
          parentStudents: {
            include: {
              student: true,
            },
          },
        },
      });
      if (!parentProfile) {
        return NextResponse.json({ error: "Profil non trouvé" }, { status: 404 });
      }
      where.studentId = { in: parentProfile.parentStudents.map(c => c.student.id) };
    } else if (session.user.role === "SUPER_ADMIN") {
      // S6 : les bourses d'une école sélectionnée, jamais de toutes
      const scope = await resolveFinanceSchool(session, searchParams.get("schoolId"), "scholarships:list");
      if (!scope.ok) return scope.response;
      where.student = { schoolId: scope.schoolId };
      if (studentId) {
        where.studentId = studentId;
      }
    } else if (roleSatisfies(session.user.role, ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"])) {
      // Admins see all scholarships for their school
      if (!getActiveSchoolId(session)) {
        return NextResponse.json({ error: "Aucun établissement associé" }, { status: 403 });
      }
      where.student = { schoolId: getActiveSchoolId(session) };
      if (studentId) {
        where.studentId = studentId;
      }
    } else {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    if (isActive !== null) {
      where.isActive = isActive === "true";
    }

    // Audit C3 (minimisation) : chaque bourse embarquait le profil élève
    // complet (adresse, date et lieu de naissance, nationalité…) et la classe
    // avec son niveau. Seuls les champs affichés par la page sortent. La liste
    // reste complète : la page calcule ses indicateurs sur l'ensemble.
    const scholarships = await prisma.scholarship.findMany({
      where,
      include: {
        student: {
          select: {
            id: true,
            matricule: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            enrollments: {
              where: { status: "ACTIVE" },
              select: { class: { select: { name: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(scholarships);
  } catch (error) {
    logger.error(" fetching scholarships:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
});

// POST /api/scholarships - Create scholarship
export const POST = createApiHandler(
  async (request, context) => {
    try {
      const session = context.session;
      const body = await request.json();
      const validatedData = createScholarshipSchema.parse(body);

      // Verify student exists and belongs to school
      const student = await prisma.studentProfile.findFirst({
        where: { id: validatedData.studentId },
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
      });

      if (!student) {
        return NextResponse.json({ error: "Étudiant non trouvé" }, { status: 404 });
      }
      if (session.user.role !== "SUPER_ADMIN" && student.schoolId !== getActiveSchoolId(session)) {
        return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
      }
      const outOfScope = await superAdminTargetOutOfScope(session, student.schoolId, "scholarships:create");
      if (outOfScope) return outOfScope;

      if (await invalidScholarshipFeeIds(prisma, student.schoolId, validatedData.feeIds)) {
        return NextResponse.json({ error: "Frais visés invalides : choisissez des frais de l'établissement de l'élève." }, { status: 400 });
      }

      // Création et recalcul des échéanciers de l'élève dans la même transaction
      // (FIN-01 : le dû suit la bourse partout, tout de suite)
      const { scholarship, adjustments } = await prisma.$transaction(async (tx) => {
        const created = await tx.scholarship.create({
          data: {
            studentId: validatedData.studentId,
            name: validatedData.name,
            type: validatedData.type,
            amount: validatedData.amount || 0,
            percentage: validatedData.percentage,
            startDate: new Date(validatedData.startDate),
            endDate: validatedData.endDate ? new Date(validatedData.endDate) : null,
            isActive: validatedData.isActive,
            notes: validatedData.notes,
            feeIds: [...new Set(validatedData.feeIds)],
          },
        });
        return { scholarship: created, adjustments: await syncScholarshipPlans(tx, validatedData.studentId) };
      });
      const studentName = `${student.user.firstName} ${student.user.lastName}`;
      for (const adjustment of adjustments.filter((a) => a.overpaid > 0)) {
        await alertFinanceStaff(student.schoolId, "Trop-perçu à rembourser", overpaymentMessage(studentName, adjustment));
      }

      // Log audit
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entity: "Scholarship",
          entityId: scholarship.id,
        },
      });

      // Notify student
      await prisma.notification.create({
        data: {
          userId: student.user.id,
          type: "SUCCESS",
          title: "Bourse accordée",
          message: `Vous avez reçu une bourse: ${scholarship.name} (${scholarship.percentage ? `${scholarship.percentage}%` : `${scholarship.amount}`})`,
          link: "/dashboard/scholarships",
        },
      });

      // Notify parents
      if (student.parentStudents.length > 0) {
        await prisma.notification.createMany({
          data: student.parentStudents.map(link => ({
            userId: link.parent.user.id,
            type: "SUCCESS",
            title: "Bourse accordée",
            message: `${student.user.firstName} ${student.user.lastName} a reçu une bourse: ${scholarship.name}`,
            link: "/dashboard/scholarships",
          })),
        });
      }

      return NextResponse.json({ ...scholarship, planAdjustments: adjustments }, { status: 201 });
    } catch (error) {
      if (isZodError(error)) {
        return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
      }
      logger.error(" creating scholarship:", error as Error);
      return NextResponse.json({ error: "Erreur" }, { status: 500 });
    }
  },
  { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] }
);
