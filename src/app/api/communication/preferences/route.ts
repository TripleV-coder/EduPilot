import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { commPreferences } from "@/lib/communication/preferences";
import { z } from "zod";

const updateSchema = z.object({
    channels: z.array(z.string()).optional(),
    language: z.string().optional(),
    quietHoursStart: z.string().nullable().optional(),
    quietHoursEnd: z.string().nullable().optional(),
});

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const prefs = await commPreferences.getUserPreferences(session.user.id);
    return NextResponse.json(prefs);
}

export async function PUT(req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const body = await req.json();
        const data = updateSchema.parse(body);

        const updated = await commPreferences.updatePreferences(session.user.id, data);
        return NextResponse.json(updated);
    } catch (error) {
        return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }
}
