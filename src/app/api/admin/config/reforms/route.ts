import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { createApiHandler, translateError } from "@/lib/api/api-helpers";
import { API_ERRORS } from "@/lib/constants/api-messages";
import { Permission } from "@/lib/rbac/permissions";
import { z } from "zod";

const reformUpdateSchema = z.object({
    category: z.enum(["NATIONAL_EXAMS", "GRADE_SETTINGS"]),
    code: z.string(),
    metadata: z.any(),
    label: z.string().optional(),
});

export const GET = createApiHandler(
    async (request, { session }, t) => {
        const { searchParams } = new URL(request.url);
        const category = searchParams.get("category");

        const where: Prisma.ConfigOptionWhereInput = {};
        if (category) where.category = category as any;

        const configs = await prisma.configOption.findMany({
            where: {
                ...where,
                schoolId: null, // Global reforms
            },
            orderBy: { category: "asc" },
        });

        return NextResponse.json(configs);
    },
    {
        requireAuth: true,
        requiredPermissions: [Permission.SYSTEM_READ],
    }
);

export const POST = createApiHandler(
    async (request, { session }, t) => {
        const body = await request.json();
        const validated = reformUpdateSchema.parse(body);

        // Check for existing global config manually to handle NULL schoolId uniqueness safely
        const existing = await prisma.configOption.findFirst({
            where: {
                schoolId: null,
                category: validated.category as any,
                code: validated.code,
            },
        });

        const config = existing
            ? await prisma.configOption.update({
                where: { id: existing.id },
                data: {
                    metadata: validated.metadata,
                    label: validated.label || validated.code,
                },
            })
            : await prisma.configOption.create({
                data: {
                    schoolId: null,
                    category: validated.category as any,
                    code: validated.code,
                    label: validated.label || validated.code,
                    metadata: validated.metadata,
                },
            });

        return NextResponse.json(config);
    },
    {
        requireAuth: true,
        requiredPermissions: [Permission.SYSTEM_WRITE],
    }
);
