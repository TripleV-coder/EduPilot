import { NextRequest, NextResponse } from "next/server";
import { exportUserData, anonymizeUser } from "@/lib/security/rgpd";
import { createApiHandler } from "@/lib/api/api-helpers";

// GET: Export user's own data
export const GET = createApiHandler(async (request, context) => {
try {
        const session = context.session;
        const data = await exportUserData(session.user.id);
        return NextResponse.json(data);
    } catch (_error) {
        return NextResponse.json({ error: "Export failed" }, { status: 500 });
    }

});

// DELETE: Request account anonymization (right to erasure)
export const DELETE = createApiHandler(async (request, context) => {
try {
        const session = context.session;
        // In production, this should queue for manual review
        const result = await anonymizeUser(session.user.id, session.user.id);
        return NextResponse.json({
            message: "Account scheduled for anonymization",
            ...result
        });
    } catch (_error) {
        return NextResponse.json({ error: "Anonymization failed" }, { status: 500 });
    }

});
