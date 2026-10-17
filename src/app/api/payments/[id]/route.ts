import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { isZodError } from "@/lib/is-zod-error";
import { createApiHandler } from "@/lib/api/api-helpers";
import { z } from "zod";
import { fcfaAmountSchema } from "@/lib/finance/money";
import { invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { assertReferenceFree, assertWithinAvailable, availableWithout, refuse, runFeeMutation } from "@/lib/finance/collection";
import { canAccessSchool, getAccessibleSchoolIds } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";

const paymentUpdateSchema = z.object({
  amount: fcfaAmountSchema.optional(),
  method: z.enum(["CASH", "MOBILE_MONEY_MTN", "MOBILE_MONEY_MOOV", "BANK_TRANSFER", "CHECK", "OTHER"]).optional(),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const GET = createApiHandler(
  async (_request, context) => {
    try {
      const session = context.session;
      const { id } = await context.params;

      const ownershipFilter: Record<string, unknown> = {};
      if (session.user.role === "PARENT") {
        const parentProfile = await prisma.parentProfile.findUnique({
          where: { userId: session.user.id },
          select: {
            parentStudents: {
              select: { studentId: true },
            },
          },
        });
        const childrenIds = parentProfile?.parentStudents.map((child) => child.studentId) ?? [];
        ownershipFilter.studentId = { in: childrenIds };
      } else if (session.user.role === "STUDENT") {
        ownershipFilter.student = { userId: session.user.id };
      } else if (session.user.role !== "SUPER_ADMIN") {
        ownershipFilter.student = {
          user: { schoolId: { in: getAccessibleSchoolIds(session) } },
        };
      }

      const payment = await prisma.payment.findFirst({
        where: { id, ...ownershipFilter },
        include: {
          student: {
            select: {
              id: true,
              userId: true,
              user: {
                select: { firstName: true, lastName: true, schoolId: true },
              },
            },
          },
          fee: {
            include: {
              academicYear: true,
            },
          },
        },
      });

      if (!payment) {
        return NextResponse.json({ error: "Paiement non trouvé" }, { status: 404 });
      }

      return NextResponse.json(payment);
    } catch (error) {
      logger.error(" fetching payment:", error as Error);
      return NextResponse.json(
        { error: "Erreur lors de la récupération du paiement" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT", "PARENT", "STUDENT"] }
);

export const PATCH = createApiHandler(
  async (request, context) => {
    try {
      const session = context.session;
      const { id } = await context.params;

      const existingPayment = await prisma.payment.findUnique({
        where: { id },
        include: {
          student: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!existingPayment) {
        return NextResponse.json({ error: "Paiement non trouvé" }, { status: 404 });
      }

      if (
        session.user.role !== "SUPER_ADMIN" &&
        !canAccessSchool(session, existingPayment.student.schoolId)
      ) {
        return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
      }

      const body = await request.json();
      const validatedData = paymentUpdateSchema.parse(body);

      // Sous verrou élève/frais : état relu, nouveau montant plafonné (lot 3b)
      const result = await runFeeMutation(existingPayment.studentId, existingPayment.feeId, async (tx, balance) => {
        const current = await tx.payment.findUnique({ where: { id } });
        if (!current) return refuse(404, "Paiement non trouvé");
        if (validatedData.amount !== undefined) {
          assertWithinAvailable(availableWithout(balance, current), validatedData.amount);
        }
        await assertReferenceFree(tx, validatedData.reference, id);
        return tx.payment.update({
          where: { id },
          data: validatedData,
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
      });
      if (!result.ok) return NextResponse.json({ error: result.refusal.error }, { status: result.refusal.status });
      const updatedPayment = result.value;

      await Promise.all([
        invalidateByPath(CACHE_PATHS.payments),
        invalidateByPath("/api/payments"),
        invalidateByPath("/api/finance/dashboard"),
        invalidateByPath("/api/finance/stats"),
        invalidateByPath("/api/finance/reports/generate"),
      ]);

      return NextResponse.json(updatedPayment);
    } catch (error: unknown) {
      logger.error(" updating payment:", error as Error);
      if (isZodError(error)) {
        return NextResponse.json(
          { error: "Données invalides", details: error.issues },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: "Erreur lors de la mise à jour du paiement" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] }
);

export const DELETE = createApiHandler(
  async (_request, context) => {
    try {
      const session = context.session;
      const { id } = await context.params;

      const existingPayment = await prisma.payment.findUnique({
        where: { id },
        include: {
          student: {
            include: {
              user: true,
            },
          },
        },
      });

      if (!existingPayment) {
        return NextResponse.json({ error: "Paiement non trouvé" }, { status: 404 });
      }

      if (
        session.user.role !== "SUPER_ADMIN" &&
        !canAccessSchool(session, existingPayment.student.schoolId)
      ) {
        return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
      }

      // Sous verrou élève/frais : pas de recalcul concurrent perdu (lot 3b)
      const result = await runFeeMutation(existingPayment.studentId, existingPayment.feeId, (tx) =>
        tx.payment.update({ where: { id }, data: { status: "CANCELLED", cancellationSource: "MANUAL" } }),
      );
      if (!result.ok) return NextResponse.json({ error: result.refusal.error }, { status: result.refusal.status });

      await Promise.all([
        invalidateByPath(CACHE_PATHS.payments),
        invalidateByPath("/api/payments"),
        invalidateByPath("/api/finance/dashboard"),
        invalidateByPath("/api/finance/stats"),
        invalidateByPath("/api/finance/reports/generate"),
      ]);

      return NextResponse.json({ success: true });
    } catch (error) {
      logger.error(" deleting payment:", error as Error);
      return NextResponse.json(
        { error: "Erreur lors de la suppression du paiement" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] }
);
