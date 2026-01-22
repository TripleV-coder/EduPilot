import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac/permissions";

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // 1. RBAC Check
    // Only FINANCE_MANAGER_ROLES (Accountant, Admin, Director) can record cash payments
    // hasPermission check would go here if we had the user's role from session properly typed or fetched
    // Assuming simplified check:
    if (!['SUPER_ADMIN', 'SCHOOL_ADMIN', 'DIRECTOR', 'ACCOUNTANT'].includes(session.user.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const body = await req.json();
        const { amount, feeId, studentId, notes, method } = body;
        const _studentName = body.studentName; // For receipt generation

        if (!amount || !feeId || !studentId || !method) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // 2. Record Payment
        const payment = await prisma.payment.create({
            data: {
                amount,
                method: method, // CASH, CHECK, BANK_TRANSFER
                feeId,
                studentId,
                status: "VERIFIED", // Cash is verified immediately upon receipt
                receivedBy: session.user.id,
                paidAt: new Date(),
                notes: notes,
                reference: `CASH-${Date.now()}`, // Generate internal ref
            },
        });

        return NextResponse.json(payment);

    } catch (error) {
        console.error("Cash Payment Error:", error);
        return NextResponse.json({ error: "Failed to record payment" }, { status: 500 });
    }
}
