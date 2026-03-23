import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exportUserData, anonymizeUser } from "@/lib/security/rgpd";

// GET: Export user's own data
export async function GET(_req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const data = await exportUserData(session.user.id);
        return NextResponse.json(data);
    } catch (_error) {
        return NextResponse.json({ error: "Export failed" }, { status: 500 });
    }
}

// DELETE: Request account anonymization (right to erasure)
export async function DELETE(_req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        // In production, this should queue for manual review
        const result = await anonymizeUser(session.user.id, session.user.id);
        return NextResponse.json({
            message: "Account scheduled for anonymization",
            ...result
        });
    } catch (_error) {
        return NextResponse.json({ error: "Anonymization failed" }, { status: 500 });
    }
}
