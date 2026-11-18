import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { buildCursorPage, getCursorParams, keysetOrderBy, keysetWhere } from "@/lib/api/pagination";
import { PaymentStatus } from "@prisma/client";
import { createApiHandler } from "@/lib/api/api-helpers";
import { ensureRequestedSchoolAccess, getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { resolveFinanceSchool } from "@/lib/finance/finance-scope";
import { logger } from "@/lib/utils/logger";
import { appendNote } from "@/lib/finance/helpers";

/**
 * API Endpoint for payment reconciliation
 * Allows reconciling multiple payments at once (bank statement matching)
 */

/**
 * Passe à RECONCILED ceux des paiements encore VERIFIED, en AJOUTANT la note
 * de rapprochement aux notes existantes (trop-perçu, écart « à rapprocher » :
 * lot 3e). Les lignes sont verrouillées : deux rapprochements simultanés ou
 * répétés ne traitent chaque paiement qu'une fois, sans note en double.
 */
async function reconcileVerified(ids: string[], line: string, userId: string) {
  const reconciledAt = new Date();
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string; notes: string | null }>>`
      SELECT "id", "notes" FROM "payments"
      WHERE "id" = ANY(${ids}) AND "status" = 'VERIFIED'
      FOR UPDATE`;
    const updated = [];
    for (const row of rows) {
      updated.push(
        await tx.payment.update({
          where: { id: row.id },
          data: { status: "RECONCILED", reconciledAt, reconciledBy: userId, notes: appendNote(row.notes, line) },
        }),
      );
    }
    return updated;
  });
}

export const POST = createApiHandler(
  async (request, context) => {
    try {
      const session = context.session;

      const body = await request.json();
      const { paymentIds, notes, reconcileAllVerified } = body;
      const customNote = typeof notes === "string" && notes.trim() ? notes.trim().slice(0, 500) : null;
      let activeSchoolId = getActiveSchoolId(session);
      const schoolAccess = ensureRequestedSchoolAccess(session, body.schoolId);
      if (schoolAccess) return schoolAccess;
      // S6 : le super-admin rapproche dans l'école sélectionnée, et seulement elle
      if (session.user.role === "SUPER_ADMIN") {
        const scope = await resolveFinanceSchool(session, body.schoolId, "payments:reconcile");
        if (!scope.ok) return scope.response;
        activeSchoolId = scope.schoolId;
      }

      if (reconcileAllVerified) {
        const schoolId = activeSchoolId;

        if (!schoolId) {
          return NextResponse.json(
            { error: "ID d'établissement requis" },
            { status: 400 }
          );
        }

        const verifiedPayments = await prisma.payment.findMany({
          where: {
            status: "VERIFIED",
            reconciledAt: null,
            fee: { schoolId },
          },
          select: { id: true },
        });

        if (verifiedPayments.length === 0) {
          return NextResponse.json({
            success: true,
            count: 0,
            message: "Aucun paiement à réconcilier",
          });
        }

        const reconciledPayments = await reconcileVerified(
          verifiedPayments.map((payment) => payment.id),
          customNote ?? "Réconciliation en masse",
          session.user.id,
        );

        logger.info(`Batch reconciliation: ${reconciledPayments.length} payments reconciled by ${session.user.id}`);

        return NextResponse.json({
          success: true,
          count: reconciledPayments.length,
          message: `${reconciledPayments.length} paiements réconciliés avec succès`,
        });
      }

      if (!paymentIds || !Array.isArray(paymentIds) || paymentIds.length === 0) {
        return NextResponse.json(
          { error: "IDs de paiement requis" },
          { status: 400 }
        );
      }

      const paymentsToReconcile = await prisma.payment.findMany({
        where: { id: { in: paymentIds } },
        include: { fee: { select: { schoolId: true } } },
      });
      // Identifiant inconnu ou hors périmètre (masqué par la RLS) : refus explicite
      if (paymentsToReconcile.length !== new Set(paymentIds).size) {
        return NextResponse.json({ error: "Un ou plusieurs paiements sont introuvables" }, { status: 404 });
      }

      const schoolId = activeSchoolId;

      for (const payment of paymentsToReconcile) {
        if (payment.fee.schoolId !== schoolId) {
          return NextResponse.json(
            { error: "Certains paiements n'appartiennent pas à votre établissement" },
            { status: 403 }
          );
        }
        if (payment.status !== "VERIFIED") {
          return NextResponse.json(
            { error: `Le paiement ${payment.id} n'est pas en statut VERIFIED` },
            { status: 400 }
          );
        }
      }

      const reconciledPayments = await reconcileVerified(
        paymentsToReconcile.map((payment) => payment.id),
        customNote ?? `Réconcilié le ${new Date().toLocaleDateString("fr-FR")}`,
        session.user.id,
      );

      logger.info(`Reconciliation: ${reconciledPayments.length} payments reconciled by ${session.user.id}`);

      return NextResponse.json({
        success: true,
        count: reconciledPayments.length,
        payments: reconciledPayments,
        message: `${reconciledPayments.length} paiements réconciliés avec succès`,
      });
    } catch (error) {
      logger.error("Reconciliation error:", error as Error);
      return NextResponse.json(
        { error: "Erreur lors de la réconciliation des paiements" },
        { status: 500 }
      );
    }
  },
  { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] }
);

const PAYMENT_STATUSES: readonly PaymentStatus[] = ["PENDING", "VERIFIED", "RECONCILED", "CANCELLED", "EXPIRED"];

function isPaymentStatus(value: string): value is PaymentStatus {
  return (PAYMENT_STATUSES as readonly string[]).includes(value);
}

export const GET = createApiHandler(async (request, context) => {
  try {
    const session = context.session;

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get("schoolId");
    const status = searchParams.get("status") || "VERIFIED";
    if (!isPaymentStatus(status)) {
      return NextResponse.json({ error: "Statut de paiement invalide" }, { status: 400 });
    }
    const activeSchoolId = getActiveSchoolId(session);
    const schoolAccess = ensureRequestedSchoolAccess(session, schoolId);
    if (schoolAccess) return schoolAccess;

    if (!schoolId && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "ID d'établissement requis" },
        { status: 400 }
      );
    }

    // S6 : sans école, le super-admin voyait les paiements de tous les établissements
    let targetSchoolId = schoolId || activeSchoolId;
    if (session.user.role === "SUPER_ADMIN") {
      const scope = await resolveFinanceSchool(session, schoolId, "payments:reconcile-list");
      if (!scope.ok) return scope.response;
      targetSchoolId = scope.schoolId;
    }

    const where = {
      status,
      reconciledAt: null,
      fee: { schoolId: targetSchoolId },
    };

    // Audit M5 : liste paginée par curseur (createdAt : paidAt peut être nul)
    // et résumé calculé par PostgreSQL sur tout le périmètre, au lieu de
    // charger tous les paiements en attente pour les compter en mémoire.
    const page = getCursorParams(searchParams);
    const [rows, totals] = await Promise.all([
      prisma.payment.findMany({
        where: page.cursor ? { AND: [where, keysetWhere("createdAt", "desc", page.cursor)] } : where,
        include: {
          student: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
          fee: { select: { name: true, amount: true } },
        },
        orderBy: keysetOrderBy("createdAt", "desc"),
        take: page.limit + 1,
      }),
      prisma.payment.aggregate({ where, _count: { _all: true }, _sum: { amount: true } }),
    ]);
    const { data: payments, pagination } = buildCursorPage(rows, page.limit, (row) => row.createdAt);

    return NextResponse.json({
      payments,
      summary: {
        count: totals._count._all,
        totalAmount: Number(totals._sum.amount ?? 0),
        status,
      },
      pagination,
    });
  } catch (error) {
    logger.error("Fetching unreconciled payments error:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des paiements" },
      { status: 500 }
    );
  }
});
