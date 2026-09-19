import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { paymentSchema } from "@/lib/validations/finance";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { getListWindow } from "@/lib/api/list-window";
import { API_ERRORS } from "@/lib/constants/api-messages";
import { PaymentWhereFilter } from "@/lib/types/api";
import { cacheMiddleware, generateCacheKey, invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { withHttpCache, cachePresets } from "@/lib/api/cache-http";
import { syncPaymentPlanLedger } from "@/lib/finance/helpers";
import { canAccessSchool, getActiveSchoolId } from "@/lib/api/tenant-isolation";

/** GET /api/payments — contrat décrit par docs/openapi.json (npm run docs:openapi). */
export const GET = createApiHandler(
  async (request, { session }, t) => {
    const cacheKey = generateCacheKey("/api/payments", new URL(request.url).searchParams, session.user.id);

    const cachedHandler = cacheMiddleware({ ttl: 60, key: cacheKey });

    const handler = async () => {
      const { searchParams } = new URL(request.url);
      const studentId = searchParams.get("studentId");
      const feeId = searchParams.get("feeId");
      const activeSchoolId = getActiveSchoolId(session);

      // Lot 3 : format curseur par défaut, ?page= toléré (ancien format). Tri sur la
      // date d'encaissement, nullable : curseur positionnel.
      const list = getListWindow(request, {
        positional: true,
        orderBy: [{ paidAt: "desc" }, { id: "desc" }],
        defaultLimit: 50,
        maxLimit: 200,
      });
      const respond = <Row extends { id: string }>(rows: Row[], total: number | undefined) =>
        NextResponse.json(list.page(rows, () => 0, total));

      const where: PaymentWhereFilter = {};
      if (studentId) where.studentId = studentId;
      if (feeId) where.feeId = feeId;

      // Multi-tenant security: filter by school
      if (session.user.role !== "SUPER_ADMIN" && activeSchoolId) {
        where.fee = { schoolId: activeSchoolId };
      }

      // PARENT can only see their children's payments
      if (session.user.role === "PARENT") {
        const parentProfile = await prisma.parentProfile.findFirst({
          where: { userId: session.user.id },
          select: { parentStudents: { select: { studentId: true } } },
        });

        if (!parentProfile || parentProfile.parentStudents.length === 0) {
          return NextResponse.json({ error: "Accès refusé : aucun enfant associé à ce compte parent" }, { status: 403 });
        }

        const childrenIds = parentProfile.parentStudents.map((c) => c.studentId);

        if (studentId && !childrenIds.includes(studentId)) {
          return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
        }

        const [payments, total] = await Promise.all([
          prisma.payment.findMany({
            where: {
              studentId: { in: childrenIds },
              ...where,
            },
            select: {
              id: true,
              amount: true,
              paidAt: true,
              status: true,
              method: true,
              reference: true,
              student: {
                select: {
                  id: true,
                  user: {
                    select: { firstName: true, lastName: true },
                  },
                },
              },
              fee: {
                select: {
                  id: true,
                  name: true,
                  amount: true,
                },
              },
            },
            orderBy: list.orderBy,
            skip: list.skip,
            take: list.take,
          }),
          list.needsTotal
            ? prisma.payment.count({
                where: {
                  studentId: { in: childrenIds },
                  ...where,
                },
              })
            : Promise.resolve(undefined),
        ]);

        return respond(payments, total);
      }

      if (session.user.role === "STUDENT") {
        const studentProfile = await prisma.studentProfile.findFirst({
          where: { userId: session.user.id },
          select: { id: true },
        });

        if (!studentProfile) {
          return respond([], 0);
        }

        if (studentId && studentId !== studentProfile.id) {
          return NextResponse.json(translateError(API_ERRORS.FORBIDDEN, t), { status: 403 });
        }

        const [payments, total] = await Promise.all([
          prisma.payment.findMany({
            where: {
              studentId: studentProfile.id,
              ...where,
            },
            select: {
              id: true,
              amount: true,
              paidAt: true,
              status: true,
              method: true,
              reference: true,
              student: {
                select: {
                  id: true,
                  user: {
                    select: { firstName: true, lastName: true },
                  },
                },
              },
              fee: {
                select: {
                  id: true,
                  name: true,
                  amount: true,
                },
              },
            },
            orderBy: list.orderBy,
            skip: list.skip,
            take: list.take,
          }),
          list.needsTotal
            ? prisma.payment.count({
                where: {
                  studentId: studentProfile.id,
                  ...where,
                },
              })
            : Promise.resolve(undefined),
        ]);

        return respond(payments, total);
      }

      const [payments, total] = await Promise.all([
        prisma.payment.findMany({
          where,
          select: {
            id: true,
            amount: true,
            paidAt: true,
            status: true,
            method: true,
            reference: true,
            student: {
              select: {
                id: true,
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
            fee: {
              select: {
                id: true,
                name: true,
                amount: true,
              },
            },
          },
          orderBy: list.orderBy,
          skip: list.skip,
          take: list.take,
        }),
        list.needsTotal ? prisma.payment.count({ where }) : Promise.resolve(undefined),
      ]);

      return respond(payments, total);
    };

    const response = await cachedHandler(handler, request);
    return withHttpCache(response, request, { ...cachePresets.private(), maxAge: 60 });
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT", "PARENT", "STUDENT"],
  }
);

/** POST /api/payments — contrat décrit par docs/openapi.json (npm run docs:openapi). */
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

    if (session.user.role !== "SUPER_ADMIN" && !canAccessSchool(session, fee.schoolId)) {
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

    if (session.user.role !== "SUPER_ADMIN" && !canAccessSchool(session, student.schoolId)) {
      return NextResponse.json(
        translateError({ error: "Cet élève n'appartient pas à votre établissement", key: "api.issues.forbidden" }, t),
        { status: 403 }
      );
    }

    const payment = await prisma.$transaction(async (tx) => {
      const createdPayment = await tx.payment.create({
        data: {
          studentId: validatedData.studentId,
          feeId: validatedData.feeId,
          amount: validatedData.amount,
          method: validatedData.method,
          reference: validatedData.reference,
          notes: validatedData.notes,
          receivedBy: session.user.id,
          status: "VERIFIED",
          paidAt: validatedData.paidAt || new Date(),
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

      await syncPaymentPlanLedger(tx, validatedData.studentId, validatedData.feeId);

      return createdPayment;
    });

    await Promise.all([
      invalidateByPath(CACHE_PATHS.payments),
      invalidateByPath("/api/payments"),
      invalidateByPath("/api/finance/dashboard"),
      invalidateByPath("/api/finance/stats"),
      invalidateByPath("/api/finance/reports/generate"),
    ]);

    return NextResponse.json(payment, { status: 201 });
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"],
  }
);
