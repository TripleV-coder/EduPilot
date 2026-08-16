import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { z } from "zod";
import { createApiHandler } from "@/lib/api/api-helpers";

const categorySchema = z.object({
    name: z.string().min(1),
    code: z.string().min(1),
    description: z.string().optional(),
    color: z.string().optional(),
    icon: z.string().optional(),
    order: z.number().int().default(0),
    isActive: z.boolean().default(true),
});

const MANAGE_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR"];

export const GET = createApiHandler(
    async (request, context) => {
        const session = context.session;
        const schoolId = getActiveSchoolId(session);

        const categories = await prisma.subjectCategory.findMany({
            where: {
                OR: [
                    { schoolId: null }, // Global categories
                    { schoolId: schoolId || undefined } // School specific
                ],
                isActive: true,
            },
            orderBy: { order: 'asc' },
        });

        return NextResponse.json(categories);
    },
);

export const POST = createApiHandler(
    async (request, context) => {
        const session = context.session;

        try {
            const schoolId = getActiveSchoolId(session);
            const body = await request.json();
            const validated = categorySchema.parse(body);

            const category = await prisma.subjectCategory.create({
                data: {
                    ...validated,
                    schoolId: session.user.role === "SUPER_ADMIN" && !schoolId ? null : schoolId,
                },
            });

            return NextResponse.json(category);
        } catch (error) {
            if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues }, { status: 400 });
            throw error;
        }
    },
    { allowedRoles: MANAGE_ROLES },
);
