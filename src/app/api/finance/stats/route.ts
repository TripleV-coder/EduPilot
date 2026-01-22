import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const allowedRoles = ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT", "DIRECTOR"];
        if (!allowedRoles.includes(session.user.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Get School ID
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { schoolId: true }
        });

        if (!user?.schoolId) {
            return NextResponse.json({ error: "School not found" }, { status: 400 });
        }

        const schoolId = user.schoolId;

        // Calculate Global Stats
        // 1. Total Fees Expected (Sum of all Fees * Students relevant? Or Sum of PaymentPlans?)
        // Reliable way: Sum of PaymentPlans totalAmount.

        const totalExpected = await prisma.paymentPlan.aggregate({
            where: { fee: { schoolId } }, // Plan -> Fee -> School
            _sum: { totalAmount: true }
        });

        // 2. Total Collected
        const totalCollected = await prisma.payment.aggregate({
            where: {
                fee: { schoolId },
                status: { in: ["VERIFIED", "RECONCILED"] }
            },
            _sum: { amount: true }
        });

        // 3. Payments Count
        const paymentsCount = await prisma.payment.count({
            where: { fee: { schoolId } }
        });

        // 4. Students with balance (PaymentPlan where paidAmount < totalAmount)
        // Prisma aggregate doesn't do complex filters easy, use count
        // But we need to check field comparison.
        // Easier to fetch all active plans and filter in JS if not too many, or use raw query.
        // For large scale, use raw query. For now, let's approximation or simple logic.
        // Let's use `status: "ACTIVE"` assuming we update status correctly.
        const pendingPlansCount = await prisma.paymentPlan.count({
            where: {
                fee: { schoolId },
                status: "ACTIVE" // Assuming ACTIVE means not fully paid
            }
        });

        // Recent Payments
        const recentPayments = await prisma.payment.findMany({
            where: { fee: { schoolId } },
            take: 5,
            orderBy: { createdAt: "desc" },
            include: {
                student: {
                    include: { user: { select: { firstName: true, lastName: true } } }
                },
                fee: { select: { name: true } }
            }
        });

        // Payments by Method (Chart)
        const paymentsByMethod = await prisma.payment.groupBy({
            by: ['method'],
            where: { fee: { schoolId } },
            _sum: { amount: true },
            _count: { _all: true }
        });

        return NextResponse.json({
            summary: {
                totalFees: totalExpected._sum.totalAmount || 0,
                totalCollected: totalCollected._sum.amount || 0,
                totalPending: (Number(totalExpected._sum.totalAmount || 0) - Number(totalCollected._sum.amount || 0)),
                collectionRate: totalExpected._sum.totalAmount ? (Number(totalCollected._sum.amount) / Number(totalExpected._sum.totalAmount)) * 100 : 0,
                paymentsCount,
                studentsWithBalance: pendingPlansCount // Approximation
            },
            recentPayments,
            paymentsByMethod: paymentsByMethod.map(p => ({
                method: p.method,
                total: p._sum.amount || 0,
                count: p._count._all
            }))
        });

    } catch (error) {
        console.error("Error fetching stats:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
