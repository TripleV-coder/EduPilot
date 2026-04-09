import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { paymentSchema } from "@/lib/validations/finance";
import { createApiHandler, translateError, getPaginationParams, createPaginatedResponse } from "@/lib/api/api-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";
import { PaymentWhereFilter } from "@/lib/types/api";
import { cacheMiddleware, generateCacheKey, invalidateByPath, CACHE_PATHS } from "@/lib/api/cache-helpers";
import { withHttpCache, cachePresets } from "@/lib/api/cache-http";
import { syncPaymentPlanLedger } from "@/lib/finance/helpers";
import { canAccessSchool, getActiveSchoolId } from "@/lib/api/tenant-isolation";

/**
 * GET /api/payments
 * Liste des paiements
 * @swagger
 * /api/payments:
 *   get:
 *     summary: Liste des paiements
 *     description: Récupère la liste paginée des paiements avec filtres optionnels
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: studentId
 *         in: query
 *         schema:
 *           type: string
 *         description: Filtrer par élève
 *       - name: feeId
 *         in: query
 *         schema:
 *           type: string
 *         description: Filtrer par frais
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Liste des paiements
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Payment'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
export const GET = createApiHandler(
  async (request, { session }, t) => {
    const cacheKey = generateCacheKey("/api/payments", new URL(request.url).searchParams, session.user.id);

    const cachedHandler = cacheMiddleware<any>({ ttl: 60, key: cacheKey });

    const handler = async () => {
      const { searchParams } = new URL(request.url);
      const studentId = searchParams.get("studentId");
      const feeId = searchParams.get("feeId");
      const activeSchoolId = getActiveSchoolId(session);

      const { page, limit, skip } = getPaginationParams(request, { defaultLimit: 50, maxLimit: 200 });

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
          return createPaginatedResponse([], 0, { page, limit, skip });
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
            orderBy: { paidAt: "desc" },
            skip,
            take: limit,
          }),
          prisma.payment.count({
            where: {
              studentId: { in: childrenIds },
              ...where,
            },
          }),
        ]);

        return createPaginatedResponse(payments, total, { page, limit, skip });
      }

      if (session.user.role === "STUDENT") {
        const studentProfile = await prisma.studentProfile.findFirst({
          where: { userId: session.user.id },
          select: { id: true },
        });

        if (!studentProfile) {
          return createPaginatedResponse([], 0, { page, limit, skip });
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
            orderBy: { paidAt: "desc" },
            skip,
            take: limit,
          }),
          prisma.payment.count({
            where: {
              studentId: studentProfile.id,
              ...where,
            },
          }),
        ]);

        return createPaginatedResponse(payments, total, { page, limit, skip });
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
          orderBy: { paidAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.payment.count({ where }),
      ]);

      return createPaginatedResponse(payments, total, { page, limit, skip });
    };

    const response = await cachedHandler(handler, request);
    return withHttpCache(response, request, { ...cachePresets.private(), maxAge: 60 });
  },
  {
    requireAuth: true,
    allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT", "PARENT", "STUDENT"],
  }
);

/**
 * POST /api/payments
 * Enregistrer un paiement
 * @swagger
 * /api/payments:
 *   post:
 *     summary: Enregistrer un paiement
 *     description: Crée un nouveau paiement pour un élève
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - studentId
 *               - feeId
 *               - amount
 *               - method
 *             properties:
 *               studentId:
 *                 type: string
 *               feeId:
 *                 type: string
 *               amount:
 *                 type: number
 *                 format: decimal
 *               method:
 *                 type: string
 *                 enum: [CASH, MOBILE_MONEY, BANK_TRANSFER, CARD]
 *               reference:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Paiement créé avec succès
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Payment'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
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
