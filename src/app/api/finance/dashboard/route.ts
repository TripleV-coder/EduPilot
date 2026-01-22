import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/utils/logger";

/**
 * API Endpoint for Finance Dashboard data
 */

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const schoolId = searchParams.get("schoolId");
    const academicYearId = searchParams.get("academicYearId");

    if (!schoolId) {
      return NextResponse.json(
        { error: "ID d'établissement requis" },
        { status: 400 }
      );
    }

    // Security check
    if (session.user.role !== "SUPER_ADMIN" && session.user.schoolId !== schoolId) {
      return NextResponse.json(
        { error: "Accès non autorisé" },
        { status: 403 }
      );
    }

    // Build where clause
    const where: Record<string, unknown> = {
      fee: { schoolId },
    };

    if (academicYearId) {
      where.fee = { ...where.fee as object, academicYearId };
    }

    // Get current date for trend calculations
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Fetch summary data
    const [
      totalFees,
      totalCollected,
      totalPending,
      _totalOverdue,
      recentPayments,
      overdueStudents,
      paymentsTrend,
    ] = await Promise.all([
      // Total fees for the period
      prisma.fee.aggregate({
        where: { schoolId, isActive: true },
        _sum: { amount: true },
      }),

      // Total collected payments
      prisma.payment.aggregate({
        where: {
          ...where,
          status: { in: ["VERIFIED", "RECONCILED"] },
        },
        _sum: { amount: true },
      }),

      // Total pending payments
      prisma.payment.aggregate({
        where: {
          ...where,
          status: "PENDING",
        },
        _sum: { amount: true },
      }),

      // Total overdue (payments past due date for their fees)
      prisma.payment.groupBy({
        by: ["studentId"],
        where: {
          ...where,
          status: { in: ["PENDING"] },
        },
        _sum: { amount: true },
      }),

      // Recent payments
      prisma.payment.findMany({
        where,
        include: {
          student: {
            include: {
              user: { select: { firstName: true, lastName: true } },
            },
          },
          fee: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),

      // Students with overdue balances
      prisma.studentProfile.findMany({
        where: { schoolId },
        include: {
          user: { select: { firstName: true, lastName: true } },
          payments: {
            where: { status: { in: ["PENDING"] } },
            select: { amount: true },
          },
        },
        take: 20,
      }),

      // Payments trend for the last 30 days
      prisma.payment.findMany({
        where: {
          ...where,
          status: { in: ["VERIFIED", "RECONCILED"] },
          createdAt: { gte: thirtyDaysAgo },
        },
        select: { amount: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // Calculate overdue students
    const overdueStudentsWithBalance = overdueStudents
      .filter((s) => {
        const _totalPaid = s.payments.reduce((sum, p) => sum + Number(p.amount), 0);
        // This is a simplified calculation - in production you'd calculate based on fees vs payments
        return s.payments.length > 0;
      })
      .map((s) => ({
        studentId: s.id,
        studentName: `${s.user.firstName} ${s.user.lastName}`,
        balance: s.payments.reduce((sum, p) => sum + Number(p.amount), 0),
      }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 10);

    // Calculate collection rate
    const totalFeesAmount = Number(totalFees._sum.amount) || 0;
    const totalCollectedAmount = Number(totalCollected._sum.amount) || 0;
    const collectionRate = totalFeesAmount > 0
      ? (totalCollectedAmount / totalFeesAmount) * 100
      : 0;

    // Calculate payments trend by day
    const paymentsByDay = paymentsTrend.reduce((acc, payment) => {
      const dateKey = payment.createdAt.toISOString().split("T")[0];
      if (!acc[dateKey]) {
        acc[dateKey] = { date: dateKey, amount: 0, count: 0 };
      }
      acc[dateKey].amount += Number(payment.amount);
      acc[dateKey].count += 1;
      return acc;
    }, {} as Record<string, { date: string; amount: number; count: number }>);

    const paymentsTrendArray = Object.values(paymentsByDay).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return NextResponse.json({
      summary: {
        totalFees: totalFeesAmount,
        totalCollected: totalCollectedAmount,
        totalPending: Number(totalPending._sum.amount) || 0,
        collectionRate,
      },
      recentPayments,
      overdueStudents: overdueStudentsWithBalance,
      paymentsTrend: paymentsTrendArray,
    });
  } catch (error) {
    logger.error("Finance dashboard error:", error as Error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération du dashboard financier" },
      { status: 500 }
    );
  }
}
