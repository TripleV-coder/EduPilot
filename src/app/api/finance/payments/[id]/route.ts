import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = params;
        const body = await request.json();

        // Allow partial updates or specific actions
        // For now, assume it's a full update or status update
        // If body contains status, it's a status update (Verify)

        // Check permissions
        if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"].includes(session.user.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const payment = await prisma.payment.update({
            where: { id },
            data: {
                // Allow updating basics
                amount: body.amount,
                method: body.method,
                reference: body.reference,
                status: body.status, // Can be used for verify
                notes: body.notes,
                paidAt: body.paidAt ? new Date(body.paidAt) : undefined,
            },
            include: {
                student: { include: { user: true } },
                fee: true
            }
        });

        return NextResponse.json(payment);
    } catch (error) {
        console.error("Error updating payment:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"].includes(session.user.role)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await prisma.payment.delete({
            where: { id: params.id }
        });

        // TODO: Update PaymentPlan paidAmount (decrement)

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting payment:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
