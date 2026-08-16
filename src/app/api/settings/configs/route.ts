import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getActiveSchoolId } from "@/lib/api/tenant-isolation";
import { z } from "zod";
import { createApiHandler } from "@/lib/api/api-helpers";

const configSchema = z.object({
    category: z.string().min(1),
    code: z.string().min(1),
    label: z.string().min(1),
    description: z.string().optional(),
    order: z.number().int().default(0),
    isActive: z.boolean().default(true),
    metadata: z.unknown().optional(),
});

export const GET = createApiHandler(async (request, context) => {
    try {
        const session = context.session;

        const schoolId = await getActiveSchoolId(session);
        
        const configs = await prisma.configOption.findMany({
            where: { schoolId: schoolId || undefined },
            orderBy: { createdAt: 'asc' },
        });

        return NextResponse.json(configs);
    
    } catch (error) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }

});

export const POST = createApiHandler(async (request, context) => {
    try {
        const session = context.session;

        const schoolId = await getActiveSchoolId(session);
        const body = await request.json();
        const validated = configSchema.parse(body);

        // Since there is no unique constraint on schoolId + code, we use findFirst
        const existing = await prisma.configOption.findFirst({
            where: {
                schoolId: schoolId || null,
                code: validated.code,
                category: validated.category,
            }
        });

        let config;
        if (existing) {
             config = await prisma.configOption.update({
                where: { id: existing.id },
                data: {
                    ...validated,
                    metadata: validated.metadata ? JSON.stringify(validated.metadata) : undefined
                },
             });
        } else {
             config = await prisma.configOption.create({
                data: {
                    ...validated,
                    schoolId: schoolId || null,
                    metadata: validated.metadata ? JSON.stringify(validated.metadata) : undefined
                },
             });
        }

        return NextResponse.json(config);
    
    } catch (error) {
        if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues }, { status: 400 });
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }

}, { allowedRoles: ["SUPER_ADMIN", "SCHOOL_ADMIN"] });
