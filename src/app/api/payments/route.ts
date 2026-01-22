import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { paymentSchema } from "@/lib/validations/finance";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";
import { PaymentWhereFilter } from "@/lib/types/api";

/**
 * GET /api/payments
 * Liste des paiements
 */
export const GET = createApiHandler(
  async (request, { session }, t) => {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get("studentId");
    const feeId = searchParams.get("feeId");

    const where: PaymentWhereFilter = {};
    if (studentId) where.studentId = studentId;
    if (feeId) where.feeId = feeId;

    // Multi-tenant security: filter by school
    if (session.user.role !== "SUPER_ADMIN" && session.user.schoolId) {
      where.fee = { schoolId: session.user.schoolId };
    }

    // PARENT can only see their children's payments
    if (session.user.role === "PARENT") {
      const parentProfile = await prisma.parentProfile.findFirst({
        where: { userId: session.user.id },
        include: { children: { select: { studentId: true } } },
      });

      if (!parentProfile || parentProfile.children.length === 0) {
        return NextResponse.json([]);
      }

      const childrenIds = parentProfile.children.map((c) => c.studentId);

      if (studentId && !childrenIds.includes(studentId)) {
        return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
      }

      return NextResponse.json(
        await prisma.payment.findMany({
          where: {
            studentId: { in: childrenIds },
            ...where,
          },
          include: {
            student: {
              include: { user: { select: { firstName: true, lastName: true } } },
            },
            fee: true,
          },
          orderBy: { paidAt: "desc" },
        })
      );
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        student: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        fee: true,
      },
      orderBy: { paidAt: "desc" },
    });

    return NextResponse.json(payments);
  },
  {
    requireAuth: true,
  }
);

/**
 * POST /api/payments
 * Enregistrer un paiement
 */
export const POST = createApiHandler(
  async (request, { session }, t) => {
    const body = await request.json();
    const validatedData = paymentSchema.parse(body);

    // Verify fee belongs to user's school
    const fee = await prisma.fee.findUnique({
      where: { id: validatedData.feeId },
      select: { id: true, schoolId: true, amount: true },
    });

    if (!fee) {
      return NextResponse.json(
        translateError({ error: "Frais non trouvé", key: "api.issues.not_found", params: { resource: "Frais" } }, t),
        { status: 404 }
      );
    }

    if (session.user.role !== "SUPER_ADMIN" && fee.schoolId !== session.user.schoolId) {
      return NextResponse.json(
        translateError({ error: "Vous ne pouvez pas enregistrer de paiements pour d'autres établissements", key: "api.issues.forbidden" }, t),
        { status: 403 }
      );
    }

    // Verify student belongs to same school
    const student = await prisma.studentProfile.findUnique({
      where: { id: validatedData.studentId },
      select: { id: true, schoolId: true },
    });

    if (!student) {
      return NextResponse.json(
        translateError({ error: "Élève non trouvé", key: "api.issues.not_found", params: { resource: "Élève" } }, t),
        { status: 404 }
      );
    }

    if (session.user.role !== "SUPER_ADMIN" && student.schoolId !== session.user.schoolId) {
      return NextResponse.json(
        translateError({ error: "Cet élève n'appartient pas à votre établissement", key: "api.issues.forbidden" }, t),
        { status: 403 }
      );
    }

    const payment = await prisma.payment.create({
      data: {
        studentId: validatedData.studentId,
        feeId: validatedData.feeId,
        amount: validatedData.amount,
        method: validatedData.method,
        reference: validatedData.reference,
        notes: validatedData.notes,
        receivedBy: session.user.id,
      },
      include: {
        student: {
          include: {
            user: {
              select: { firstName: true, lastName: true },
            },
          },
        },
        fee: true,
      },
    });

    return NextResponse.json(payment, { status: 201 });
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"],
  }
);
