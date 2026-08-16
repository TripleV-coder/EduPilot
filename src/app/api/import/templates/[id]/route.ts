import { NextResponse } from "next/server";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createApiHandler } from "@/lib/api/api-helpers";

const updateTemplateSchema = z.object({
    name: z.string().min(1).optional(),
    mappings: z.record(z.string(), z.string()).optional(),
});

const ALLOWED_TEMPLATE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"];

export const GET = createApiHandler(
    async (request, context) => {
        const { id } = await context.params;
        const session = context.session;

        const template = await prisma.importTemplate.findUnique({
            where: { id },
        });

        if (!template) {
            return NextResponse.json({ error: "Template not found" }, { status: 404 });
        }

        // Verify access
        if (template.schoolId !== getActiveSchoolId(session)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        return NextResponse.json(template);
    },
    { allowedRoles: ALLOWED_TEMPLATE_ROLES },
);

export const PUT = createApiHandler(
    async (request, context) => {
        const { id } = await context.params;
        const session = context.session;

        try {
            const template = await prisma.importTemplate.findUnique({
                where: { id },
            });

            if (!template) {
                return NextResponse.json({ error: "Template not found" }, { status: 404 });
            }

            if (template.schoolId !== getActiveSchoolId(session)) {
                return NextResponse.json({ error: "Forbidden" }, { status: 403 });
            }

            const body = await request.json();
            const validatedData = updateTemplateSchema.parse(body);

            const updated = await prisma.importTemplate.update({
                where: { id },
                data: {
                    name: validatedData.name,
                    mappings: validatedData.mappings,
                },
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
    },
    { allowedRoles: ALLOWED_TEMPLATE_ROLES },
);

export const DELETE = createApiHandler(
    async (request, context) => {
        const { id } = await context.params;
        const session = context.session;

        const template = await prisma.importTemplate.findUnique({
            where: { id },
        });

        if (!template) {
            return NextResponse.json({ error: "Template not found" }, { status: 404 });
        }

        if (template.schoolId !== getActiveSchoolId(session)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        await prisma.importTemplate.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    },
    { allowedRoles: ALLOWED_TEMPLATE_ROLES },
);
