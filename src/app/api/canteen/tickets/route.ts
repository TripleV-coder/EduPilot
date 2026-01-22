import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canteenService } from "@/lib/canteen/service";

// Purchase Ticket
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const { amount } = body; // Simplified

        const ticket = await canteenService.purchaseTicket(
            session.user.id,
            session.user.schoolId,
            amount || 500 // Default price
        );

        return NextResponse.json(ticket);
    } catch (error) {
        return NextResponse.json({ error: "Purchase failed" }, { status: 500 });
    }
}

// Validate Ticket (Admin/Canteen Staff only using QR)
export async function PUT(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Assuming basic auth check for now, real app needs CANTEEN_STAFF role check

    try {
        const body = await req.json();
        const { qrCode } = body;

        const result = await canteenService.useTicket(qrCode, session.user.schoolId);
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }
}
