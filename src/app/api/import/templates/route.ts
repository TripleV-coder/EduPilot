import { NextResponse } from "next/server";
import { isZodError } from "@/lib/is-zod-error";
import prisma from "@/lib/prisma";
import { ImportType } from "@prisma/client";
import { z } from "zod";
import { logger } from "@/lib/utils/logger";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { createApiHandler } from "@/lib/api/api-helpers";

const templateSchema = z.object({
    name: z.string().min(1, "Le nom est requis"),
    type: z.enum(["TEACHERS", "STUDENTS", "CLASSES", "PARENTS"]),
    mappings: z.record(z.string(), z.string()),
});

const ALLOWED_TEMPLATE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "ACCOUNTANT"];

export const GET = createApiHandler(
    async (request, context) => {
        const session = context.session;

        const { searchParams } = new URL(request.url);
        const type = searchParams.get("type");

        const schoolId = getActiveSchoolId(session);
        if (!schoolId) {
            return NextResponse.json({ error: "School ID required" }, { status: 400 });
        }

        const templates = await prisma.importTemplate.findMany({
            where: {
                schoolId,
                ...(type && { type: type as ImportType }),
            },
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json(templates);
    },
    { allowedRoles: ALLOWED_TEMPLATE_ROLES },
);

export const POST = createApiHandler(
    async (request, context) => {
        const session = context.session;

        try {
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
                    type: validatedData.type as ImportType,
                    mappings: validatedData.mappings,
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
    },
    { allowedRoles: ALLOWED_TEMPLATE_ROLES },
);
