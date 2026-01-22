import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { messageRouter } from "@/lib/communication/router";
import { SendMessageOptions } from "@/lib/communication/types";
import { Permission, hasPermission } from "@/lib/rbac/permissions";

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Only admins or school admins should be able to send generic messages via this API
    // Simplification: Check if user has schoolId
    if (!session.user.schoolId) {
        return NextResponse.json({ error: "Forbidden: No School Context" }, { status: 403 });
    }

    try {
        const body = await req.json();
        // Basic validation
        if (!body.recipient || !body.content || !body.channel) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const options: SendMessageOptions = {
            ...body,
            userId: session.user.id,
            schoolId: session.user.schoolId,
        };

        const result = await messageRouter.sendMessage(options);

        if (result.success) {
            return NextResponse.json(result);
        } else {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

    } catch (error) {
        return NextResponse.json({ error: "Internal Error" }, { status: 500 });
    }
}
