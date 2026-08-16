import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { createApiHandler } from "@/lib/api/api-helpers";

const categorySchema = z.object({
    name: z.string().min(1).optional(),
    code: z.string().min(1).optional(),
    description: z.string().optional(),
    color: z.string().optional(),
    icon: z.string().optional(),
    order: z.number().int().optional(),
    isActive: z.boolean().optional(),
});

const MANAGE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];

export const GET = createApiHandler(
    async (request, context) => {
        const { id } = await context.params;

        const category = await prisma.subjectCategory.findUnique({
            where: { id },
        });

        if (!category) return NextResponse.json({ error: "Not Found" }, { status: 404 });

        return NextResponse.json(category);
    },
);

export const PATCH = createApiHandler(
    async (request, context) => {
        const { id } = await context.params;

        try {
            const body = await request.json();
            const validated = categorySchema.parse(body);

            const category = await prisma.subjectCategory.update({
                where: { id },
                data: validated,
            });

            return NextResponse.json(category);
        } catch (error) {
            if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues }, { status: 400 });
            throw error;
        }
    },
    { allowedRoles: MANAGE_ROLES },
);

export const DELETE = createApiHandler(
    async (request, context) => {
        const { id } = await context.params;

        await prisma.subjectCategory.update({
            where: { id },
            data: { isActive: false },
        });

        return NextResponse.json({ success: true });
    },
    { allowedRoles: MANAGE_ROLES },
);
