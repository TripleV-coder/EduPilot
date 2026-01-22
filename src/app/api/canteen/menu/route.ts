import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canteenService } from "@/lib/canteen/service";

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.schoolId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { searchParams } = new URL(req.url);
        const dateParam = searchParams.get('date');
        const date = dateParam ? new Date(dateParam) : new Date();

        const menu = await canteenService.getMenu(session.user.schoolId, date);
        return NextResponse.json(menu || { message: "No menu found for this date" });
    } catch (error) {
        console.error("Menu Error:", error);
        return NextResponse.json({ error: "Failed to fetch menu" }, { status: 500 });
    }
}
