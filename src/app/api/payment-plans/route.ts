import { NextRequest, NextResponse } from "next/server";
import { Prisma, PaymentPlanStatus } from "@prisma/client";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import { logger } from "@/lib/utils/logger";

const createPaymentPlanSchema = z.object({
  studentId: z.string().cuid(),
  feeId: z.string().cuid(),
  installments: z.number().int().min(2).max(12),
  startDate: z.string().datetime(),
});

// GET /api/payment-plans - List payment plans
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const status = searchParams.get("status");

    const where: Prisma.PaymentPlanWhereInput = {};

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
      if (studentId) {
        where.studentId = studentId;
      }
    } else if (["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"].includes(session.user.role)) {
      // Admins see all plans for their school
      if (!session.user.schoolId) {
        return NextResponse.json({ error: "Aucun établissement associé" }, { status: 403 });
      }
      where.student = { schoolId: session.user.schoolId };
      if (studentId) {
        where.studentId = studentId;
      }
    } else {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    if (status) {
      where.status = status as PaymentPlanStatus;
    }

    const paymentPlans = await prisma.paymentPlan.findMany({
      where,
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
          },
        },
        fee: {
          include: {
            academicYear: true,
          },
        },
        installmentPayments: {
          orderBy: { dueDate: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(paymentPlans);
  } catch (error) {
    logger.error(" fetching payment plans:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}

// POST /api/payment-plans - Create payment plan
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"].includes(session.user.role)) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createPaymentPlanSchema.parse(body);

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
      },
    });

    if (!student) {
      return NextResponse.json({ error: "Étudiant non trouvé" }, { status: 404 });
    }
    if (session.user.role !== "SUPER_ADMIN" && student.schoolId !== session.user.schoolId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Verify fee exists
    const fee = await prisma.fee.findFirst({
      where: {
        id: validatedData.feeId,
      },
    });

    if (!fee) {
      return NextResponse.json({ error: "Frais non trouvés" }, { status: 404 });
    }
    if (session.user.role !== "SUPER_ADMIN" && fee.schoolId !== student.schoolId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    // Check if payment plan already exists for this fee
    const existingPlan = await prisma.paymentPlan.findFirst({
      where: {
        studentId: validatedData.studentId,
        feeId: validatedData.feeId,
        status: "ACTIVE",
      },
    });

    if (existingPlan) {
      return NextResponse.json({ error: "Un plan de paiement actif existe déjà pour ces frais" }, { status: 400 });
    }

    // Check for active scholarships
    const scholarships = await prisma.scholarship.findMany({
      where: {
        studentId: validatedData.studentId,
        isActive: true,
        startDate: { lte: new Date() },
        OR: [
          { endDate: null },
          { endDate: { gte: new Date() } },
        ],
      },
    });

    // Calculate total discount
    let totalAmount = new Decimal(fee.amount.toString());
    let discountAmount = new Decimal(0);

    for (const scholarship of scholarships) {
      if (scholarship.percentage) {
        const discount = totalAmount.mul(scholarship.percentage).div(100);
        discountAmount = discountAmount.add(discount);
      } else {
        discountAmount = discountAmount.add(new Decimal(scholarship.amount.toString()));
      }
    }

    totalAmount = totalAmount.sub(discountAmount);
    if (totalAmount.lessThan(0)) {
      totalAmount = new Decimal(0);
    }

    // Calculate installment amount
    const installmentAmount = totalAmount.div(validatedData.installments);

    // Generate installment dates (monthly)
    const startDate = new Date(validatedData.startDate);
    const installmentDates = [];
    for (let i = 0; i < validatedData.installments; i++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i);
      installmentDates.push(dueDate);
    }

    // Create payment plan with installments
    const paymentPlan = await prisma.paymentPlan.create({
      data: {
        studentId: validatedData.studentId,
        feeId: validatedData.feeId,
        totalAmount: totalAmount.toNumber(),
        installments: validatedData.installments,
        paidAmount: 0,
        status: "ACTIVE",
        installmentPayments: {
          create: installmentDates.map(dueDate => ({
            amount: installmentAmount.toNumber(),
            dueDate,
            status: "PENDING",
          })),
        },
      },
      include: {
        installmentPayments: {
          orderBy: { dueDate: "asc" },
        },
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
        fee: true,
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CREATE",
        entity: "PaymentPlan",
        entityId: paymentPlan.id,
      },
    });

    // Notify student
    await prisma.notification.create({
      data: {
        userId: student.user.id,
        type: "INFO",
        title: "Plan de paiement créé",
        message: `Un plan de paiement en ${validatedData.installments} mensualités a été créé pour ${fee.name}`,
        link: `/payments/plans/${paymentPlan.id}`,
      },
    });

    // Notify parents
    if (paymentPlan.student.parentStudents.length > 0) {
      await prisma.notification.createMany({
        data: paymentPlan.student.parentStudents.map(link => ({
          userId: link.parent.user.id,
          type: "INFO",
          title: "Plan de paiement créé",
          message: `Un plan de paiement en ${validatedData.installments} mensualités a été créé pour ${student.user.firstName} ${student.user.lastName}`,
          link: `/payments/plans/${paymentPlan.id}`,
        })),
      });
    }

    return NextResponse.json(paymentPlan, { status: 201 });
  } catch (error) {
    if (isZodError(error)) {
      return NextResponse.json({ error: "Données invalides", details: error.issues }, { status: 400 });
    }
    logger.error(" creating payment plan:", error as Error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
