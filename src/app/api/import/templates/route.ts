import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";

const templateSchema = z.object({
    name: z.string().min(1, "Le nom est requis"),
    type: z.enum(["TEACHERS", "STUDENTS", "CLASSES", "PARENTS"]),
    mappings: z.record(z.string(), z.string()),
});

const ALLOWED_TEMPLATE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const;

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (!ALLOWED_TEMPLATE_ROLES.includes(session.user.role as (typeof ALLOWED_TEMPLATE_ROLES)[number])) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const type = searchParams.get("type");

        const schoolId = getActiveSchoolId(session);
        if (!schoolId) {
            return NextResponse.json({ error: "School ID required" }, { status: 400 });
        }

        const templates = await prisma.importTemplate.findMany({
            where: {
                schoolId,
                ...(type && { type: type as any }),
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(templates);
    } catch (error) {
        logger.error("Error fetching templates", error instanceof Error ? error : new Error(String(error)), { module: "api/import/templates" });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!ALLOWED_TEMPLATE_ROLES.includes(session.user.role as (typeof ALLOWED_TEMPLATE_ROLES)[number])) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const validatedData = templateSchema.parse(body);

        const schoolId = getActiveSchoolId(session);
        if (!schoolId) {
            return NextResponse.json({ error: "School ID required" }, { status: 400 });
        }

        const template = await prisma.importTemplate.create({
            data: {
                schoolId,
                createdById: session.user.id,
                name: validatedData.name,
                type: validatedData.type as any,
                mappings: validatedData.mappings as any,
            },
        });

        return NextResponse.json(template);
    } catch (error) {
        logger.error("Error creating template", error instanceof Error ? error : new Error(String(error)), { module: "api/import/templates" });
        if (isZodError(error)) {
            return NextResponse.json(
                { error: "Validation failed", details: error.issues },
                { status: 400 }
            );
        }
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
