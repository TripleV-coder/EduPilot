import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ensureRequestedSchoolAccess, getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { logger } from "@/lib/utils/logger";

/**
 * API Endpoint for payment reconciliation
 * Allows reconciling multiple payments at once (bank statement matching)
 */

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    // Only authorized roles can reconcile payments
    const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"];
    if (!allowedRoles.includes(session.user.role as string)) {
      return NextResponse.json({ error: "Accès non autorisé" }, { status: 403 });
    }

    const body = await request.json();
    const { paymentIds, notes, reconcileAllVerified } = body;
    const activeSchoolId = getActiveSchoolId(session);
    const schoolAccess = ensureRequestedSchoolAccess(session, body.schoolId);
    if (schoolAccess) return schoolAccess;

    // Handle batch reconciliation of verified payments
    if (reconcileAllVerified) {
      const schoolId = session.user.role === "SUPER_ADMIN"
        ? body.schoolId
        : activeSchoolId;

      if (!schoolId) {
        return NextResponse.json(
          { error: "ID d'établissement requis" },
          { status: 400 }
        );
      }

      // Find all verified but not reconciled payments for the school
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

      const reconciledPayments = await prisma.$transaction(
        verifiedPayments.map((payment) =>
          prisma.payment.update({
            where: { id: payment.id },
            data: {
              status: "RECONCILED",
              reconciledAt: new Date(),
              reconciledBy: session.user.id,
              notes: notes || "Réconciliation en masse",
            },
          })
        )
      );

      logger.info(`Batch reconciliation: ${reconciledPayments.length} payments reconciled by ${session.user.id}`);

      return NextResponse.json({
        success: true,
        count: reconciledPayments.length,
        message: `${reconciledPayments.length} paiements réconciliés avec succès`,
      });
    }

    // Handle specific payment IDs reconciliation
    if (!paymentIds || !Array.isArray(paymentIds) || paymentIds.length === 0) {
      return NextResponse.json(
        { error: "IDs de paiement requis" },
        { status: 400 }
      );
    }

    // Verify all payments belong to user's school and are in VERIFIED status
    const paymentsToReconcile = await prisma.payment.findMany({
      where: { id: { in: paymentIds } },
      include: { fee: { select: { schoolId: true } } },
    });

    const schoolId = session.user.role === "SUPER_ADMIN"
      ? paymentsToReconcile[0]?.fee.schoolId
      : activeSchoolId;

    for (const payment of paymentsToReconcile) {
      if (session.user.role !== "SUPER_ADMIN" && payment.fee.schoolId !== schoolId) {
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

    // Perform reconciliation
    const reconciledPayments = await prisma.$transaction(
      paymentIds.map((id: string) =>
        prisma.payment.update({
          where: { id },
          data: {
            status: "RECONCILED",
            reconciledAt: new Date(),
            reconciledBy: session.user.id,
            notes: notes || `Réconcilié le ${new Date().toLocaleDateString("fr-FR")}`,
          },
        })
      )
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
}

// GET endpoint to fetch unreconciliated payments
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get("schoolId");
    const status = searchParams.get("status") || "VERIFIED"; // Default to VERIFIED status
    const activeSchoolId = getActiveSchoolId(session);
    const schoolAccess = ensureRequestedSchoolAccess(session, schoolId);
    if (schoolAccess) return schoolAccess;

    if (!schoolId && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "ID d'établissement requis" },
        { status: 400 }
      );
    }

    const targetSchoolId = session.user.role === "SUPER_ADMIN" && schoolId
      ? schoolId
      : schoolId || activeSchoolId;

    const payments = await prisma.payment.findMany({
      where: {
        status: status as any,
        reconciledAt: null,
        fee: { schoolId: targetSchoolId || undefined },
      },
      include: {
        student: {
          include: {
            user: { select: { firstName: true, lastName: true } },
          },
        },
        fee: { select: { name: true, amount: true } },
      },
      orderBy: { paidAt: "desc" },
    });

    // Calculate totals
    const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    return NextResponse.json({
      payments,
      summary: {
        count: payments.length,
        totalAmount,
        status,
      },
    });
  } catch (error) {
    logger.error("Fetching unreconciled payments error:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des paiements" },
      { status: 500 }
    );
  }
}
