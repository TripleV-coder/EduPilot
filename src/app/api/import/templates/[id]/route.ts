import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";

const updateTemplateSchema = z.object({
    name: z.string().min(1).optional(),
    mappings: z.record(z.string(), z.string()).optional(),
});

const ALLOWED_TEMPLATE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"] as const;

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (!ALLOWED_TEMPLATE_ROLES.includes(session.user.role as (typeof ALLOWED_TEMPLATE_ROLES)[number])) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const template = await prisma.importTemplate.findUnique({
            where: { id },
        });

        if (!template) {
            return NextResponse.json({ error: "Template not found" }, { status: 404 });
        }

        // Verify access
        if (template.schoolId !== session.user.schoolId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        return NextResponse.json(template);
    } catch (error) {
        logger.error("Error fetching template", error instanceof Error ? error : new Error(String(error)), { module: "api/import/templates" });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (!ALLOWED_TEMPLATE_ROLES.includes(session.user.role as (typeof ALLOWED_TEMPLATE_ROLES)[number])) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const template = await prisma.importTemplate.findUnique({
            where: { id },
        });

        if (!template) {
            return NextResponse.json({ error: "Template not found" }, { status: 404 });
        }

        if (template.schoolId !== session.user.schoolId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const validatedData = updateTemplateSchema.parse(body);

        const updated = await prisma.importTemplate.update({
            where: { id },
            data: validatedData as any,
        });

        return NextResponse.json(updated);
    } catch (error) {
        logger.error("Error updating template", error instanceof Error ? error : new Error(String(error)), { module: "api/import/templates/[id]" });
        if (isZodError(error)) {
            return NextResponse.json(
                { error: "Validation failed", details: error.issues },
                { status: 400 }
            );
        }
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (!ALLOWED_TEMPLATE_ROLES.includes(session.user.role as (typeof ALLOWED_TEMPLATE_ROLES)[number])) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const template = await prisma.importTemplate.findUnique({
            where: { id },
        });

        if (!template) {
            return NextResponse.json({ error: "Template not found" }, { status: 404 });
        }

        if (template.schoolId !== session.user.schoolId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await prisma.importTemplate.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        logger.error("Error deleting template", error instanceof Error ? error : new Error(String(error)), { module: "api/import/templates" });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
